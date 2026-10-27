import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState, reduce, getHero, normalizeMedia } from '../src/state.js';

const media = JSON.parse(readFileSync(new URL('../fixtures/media.json', import.meta.url), 'utf8'));
const variantMedia = {
  warm: ['swatch-dune', 'swatch-ember'],
  cool: ['swatch-dusk', 'swatch-lagoon'],
  empty: [],
  ghost: ['does-not-exist'],
};

test('default state uses defaultHeroId, not the first variant', () => {
  const s = createInitialState({ media, variantMedia, defaultHeroId: 'swatch-meadow' });
  assert.equal(s.heroId, 'swatch-meadow');
  assert.equal(s.selectedVariant, null);
  assert.equal(s.focusIndex, 2);
  assert.equal(getHero(s).alt, 'Meadow swatch');
});

test('missing or unknown defaultHeroId falls back to first media in order', () => {
  assert.equal(createInitialState({ media, variantMedia }).heroId, 'swatch-ember');
  assert.equal(createInitialState({ media, defaultHeroId: 'nope' }).heroId, 'swatch-ember');
  assert.equal(createInitialState({ media: [] }).heroId, null);
});

test('explicit select changes hero to the variant first media in gallery order', () => {
  const s0 = createInitialState({ media, variantMedia, defaultHeroId: 'swatch-meadow' });
  const s1 = reduce(s0, { type: 'select', variantId: 'warm' });
  // variantMedia lists dune before ember, but media order (ember=10, dune=40) wins.
  assert.equal(s1.heroId, 'swatch-ember');
  assert.equal(s1.selectedVariant, 'warm');
  const s2 = reduce(s1, { type: 'select', variantId: 'cool' });
  assert.equal(s2.heroId, 'swatch-lagoon');
  assert.equal(s0.heroId, 'swatch-meadow', 'states are immutable');
});

test('selecting a variant with no media leaves hero unchanged', () => {
  const s0 = createInitialState({ media, variantMedia, defaultHeroId: 'swatch-meadow' });
  for (const variantId of ['empty', 'ghost', 'unknown-variant']) {
    const s1 = reduce(s0, { type: 'select', variantId });
    assert.equal(s1.heroId, 'swatch-meadow', variantId);
    assert.equal(s1.focusIndex, s0.focusIndex, variantId);
    assert.equal(s1.selectedVariant, variantId);
  }
});

test('focus actions never change the hero and wrap around', () => {
  let s = createInitialState({ media, defaultHeroId: 'swatch-ember' });
  s = reduce(s, { type: 'focusPrev' });
  assert.equal(s.focusIndex, media.length - 1);
  s = reduce(s, { type: 'focusNext' });
  assert.equal(s.focusIndex, 0);
  s = reduce(s, { type: 'focusLast' });
  assert.equal(s.focusIndex, media.length - 1);
  s = reduce(s, { type: 'focusFirst' });
  assert.equal(s.focusIndex, 0);
  s = reduce(s, { type: 'focus', index: 99 });
  assert.equal(s.focusIndex, media.length - 1);
  assert.equal(s.heroId, 'swatch-ember');
});

test('reduce is deterministic and returns the same object for no-ops', () => {
  const s0 = createInitialState({ media, variantMedia, defaultHeroId: 'swatch-meadow' });
  const actions = [
    { type: 'select', variantId: 'cool' },
    { type: 'focusNext' },
    { type: 'show', mediaId: 'swatch-slate' },
    { type: 'select', variantId: 'empty' },
  ];
  const run = () => actions.reduce(reduce, s0);
  assert.deepEqual(run(), run());
  assert.equal(reduce(s0, { type: 'show', mediaId: 'missing' }), s0);
  assert.equal(reduce(s0, { type: 'bogus' }), s0);
});

test('media order is respected with stable ties', () => {
  const ordered = normalizeMedia([
    { id: 'c', src: 'c.svg', alt: 'C', kind: 'image', order: 3 },
    { id: 'a', src: 'a.svg', alt: 'A', kind: 'image', order: 1 },
    { id: 'b1', src: 'b1.svg', alt: 'B1', kind: 'video', order: 2 },
    { id: 'b2', src: 'b2.svg', alt: 'B2', kind: 'image', order: 2 },
    { id: 'z', src: 'z.svg', alt: 'Z', kind: 'image' },
  ]);
  assert.deepEqual(ordered.map((m) => m.id), ['a', 'b1', 'b2', 'c', 'z']);
});

test('invalid media is rejected', () => {
  assert.throws(() => normalizeMedia([{ id: 'x', src: 'x', alt: 'x', kind: 'audio', order: 1 }]));
  assert.throws(() =>
    normalizeMedia([
      { id: 'x', src: 'x', alt: 'x', kind: 'image', order: 1 },
      { id: 'x', src: 'y', alt: 'y', kind: 'image', order: 2 },
    ]),
  );
});
