import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { variantGallery } from '../src/variantGallery.js';

const media = JSON.parse(readFileSync(new URL('../fixtures/media.json', import.meta.url), 'utf8'));
const variantMedia = { warm: ['swatch-dune', 'swatch-ember'], cool: ['swatch-dusk'], empty: [] };

let dom;
let root;

function setup({ reduceMotionQuery = false } = {}) {
  // No `resources` option: jsdom will not load any img/video sources.
  dom = new JSDOM('<!doctype html><body><div id="g"></div></body>', { pretendToBeVisual: true });
  dom.window.matchMedia = (query) => ({
    matches: reduceMotionQuery && query === '(prefers-reduced-motion: reduce)',
    media: query,
    addEventListener() {},
    removeEventListener() {},
  });
  root = dom.window.document.getElementById('g');
}

const thumbs = () => [...root.querySelectorAll('.vg-thumb')];
const hero = () => root.querySelector('.vg-hero');
const press = (el, key) =>
  el.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

beforeEach(() => setup());
afterEach(() => dom.window.close());

test('default state renders defaultHeroId with an accessible name', () => {
  const g = variantGallery(root, { media, variantMedia, defaultHeroId: 'swatch-dusk' });
  assert.equal(g.heroId, 'swatch-dusk');
  assert.equal(g.selectedVariant, null);
  assert.equal(hero().getAttribute('aria-label'), 'Dusk swatch');
  assert.equal(hero().querySelector('img').alt, 'Dusk swatch');
  assert.equal(root.dataset.selectedVariant, undefined);
  const selected = thumbs().filter((t) => t.getAttribute('aria-selected') === 'true');
  assert.deepEqual(selected.map((t) => t.dataset.mediaId), ['swatch-dusk']);
  // Roving tabindex: exactly one tab stop, on the hero thumbnail.
  assert.deepEqual(thumbs().map((t) => t.tabIndex), [-1, -1, -1, -1, 0, -1]);
  assert.equal(root.querySelector('.vg-thumbs').getAttribute('aria-label'), 'Media thumbnails');
});

test('explicit selection via select() and the selectedVariant setter', () => {
  const changes = [];
  const g = variantGallery(root, {
    media,
    variantMedia,
    defaultHeroId: 'swatch-slate',
    onChange: (s) => changes.push(s.heroId),
  });
  g.select('warm');
  assert.equal(g.heroId, 'swatch-ember');
  assert.equal(hero().dataset.mediaId, 'swatch-ember');
  assert.equal(root.dataset.selectedVariant, 'warm');
  g.selectedVariant = 'cool';
  assert.equal(g.heroId, 'swatch-dusk');
  assert.equal(g.selectedVariant, 'cool');
  assert.deepEqual(changes, ['swatch-ember', 'swatch-dusk']);
});

test('selecting a variant with no media leaves hero unchanged', () => {
  const g = variantGallery(root, { media, variantMedia, defaultHeroId: 'swatch-lagoon' });
  const before = hero().firstElementChild;
  g.select('empty');
  g.select('not-a-variant');
  assert.equal(g.heroId, 'swatch-lagoon');
  assert.equal(hero().firstElementChild, before, 'hero element not re-rendered');
  assert.equal(hero().getAttribute('aria-label'), 'Lagoon swatch');
});

test('keyboard navigation: arrows, Home/End move roving focus without changing hero', () => {
  const g = variantGallery(root, { media, variantMedia, defaultHeroId: 'swatch-ember' });
  const doc = dom.window.document;
  thumbs()[0].focus();
  assert.equal(doc.activeElement, thumbs()[0]);

  press(thumbs()[0], 'ArrowRight');
  assert.equal(doc.activeElement, thumbs()[1]);
  assert.equal(thumbs()[1].tabIndex, 0);
  assert.equal(thumbs()[0].tabIndex, -1);

  press(doc.activeElement, 'ArrowDown');
  assert.equal(doc.activeElement, thumbs()[2]);
  press(doc.activeElement, 'ArrowUp');
  press(doc.activeElement, 'ArrowLeft');
  assert.equal(doc.activeElement, thumbs()[0]);
  press(doc.activeElement, 'ArrowLeft');
  assert.equal(doc.activeElement, thumbs()[5], 'wraps to last');
  press(doc.activeElement, 'Home');
  assert.equal(doc.activeElement, thumbs()[0]);
  press(doc.activeElement, 'End');
  assert.equal(doc.activeElement, thumbs()[5]);
  assert.equal(thumbs().filter((t) => t.tabIndex === 0).length, 1);
  assert.equal(g.heroId, 'swatch-ember', 'focus movement alone never changes hero');

  press(doc.activeElement, 'Enter');
  assert.equal(g.heroId, 'swatch-slate');
  press(thumbs()[5], 'Home');
  press(doc.activeElement, ' ');
  assert.equal(g.heroId, 'swatch-ember');
  thumbs()[3].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(g.heroId, 'swatch-dune');
  assert.equal(doc.activeElement, thumbs()[3]);
});

test('thumbnails follow media order, not input order', () => {
  const shuffled = [media[3], media[0], media[5], media[1], media[4], media[2]];
  variantGallery(root, { media: shuffled, defaultHeroId: 'swatch-ember' });
  assert.deepEqual(
    thumbs().map((t) => t.dataset.mediaId),
    media.map((m) => m.id),
  );
});

test('video media renders as <video> with an accessible name', () => {
  const withVideo = [...media, { id: 'clip', src: 'clip.mp4', alt: 'Fictional clip', kind: 'video', order: 5 }];
  const g = variantGallery(root, { media: withVideo, variantMedia: { v: ['clip'] }, defaultHeroId: 'swatch-ember' });
  assert.equal(thumbs()[0].dataset.mediaId, 'clip');
  g.select('v');
  const video = hero().querySelector('video');
  assert.ok(video);
  assert.equal(video.getAttribute('aria-label'), 'Fictional clip');
  assert.equal(hero().getAttribute('aria-label'), 'Fictional clip');
});

test('reduced-motion flag: explicit option, OS preference, and setter', () => {
  let g = variantGallery(root, { media, defaultHeroId: 'swatch-ember' });
  assert.equal(g.reducedMotion, false);
  assert.equal(root.dataset.reducedMotion, 'false');
  g.setReducedMotion(true);
  assert.equal(root.dataset.reducedMotion, 'true');
  g.destroy();

  g = variantGallery(root, { media, reducedMotion: true });
  assert.equal(root.dataset.reducedMotion, 'true');
  g.destroy();
  dom.window.close();

  setup({ reduceMotionQuery: true });
  g = variantGallery(root, { media });
  assert.equal(g.reducedMotion, true);
  assert.equal(root.dataset.reducedMotion, 'true');
});

test('stylesheet disables transitions under reduced motion and has a responsive layout', () => {
  const css = readFileSync(new URL('../src/variant-gallery.css', import.meta.url), 'utf8');
  assert.match(css, /\.vg\[data-reduced-motion='true'\][^{]*\{[^}]*transition: none !important/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /container-type: inline-size/);
  assert.match(css, /@container \(min-width: 40rem\)[\s\S]*grid-template-areas: 'thumbs hero'/);
});

test('module makes no network calls', () => {
  const src = readFileSync(new URL('../src/variantGallery.js', import.meta.url), 'utf8') +
    readFileSync(new URL('../src/state.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource/);
});

test('destroy removes rendered DOM', () => {
  const g = variantGallery(root, { media });
  g.destroy();
  assert.equal(root.children.length, 0);
  assert.ok(!root.classList.contains('vg'));
});
