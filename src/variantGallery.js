// variantGallery: renders the state machine from ./state.js into a container.
// Dependency-free; performs no network requests itself (media `src` values are
// only assigned to <img>/<video> elements).

import { createInitialState, reduce, getHero } from './state.js';

export { createInitialState, reduce, getHero, normalizeMedia } from './state.js';

const KEY_ACTIONS = {
  ArrowRight: 'focusNext',
  ArrowDown: 'focusNext',
  ArrowLeft: 'focusPrev',
  ArrowUp: 'focusPrev',
  Home: 'focusFirst',
  End: 'focusLast',
};

function detectReducedMotion(win) {
  try {
    return Boolean(win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  } catch {
    return false;
  }
}

function createMediaElement(doc, item, className) {
  if (item.kind === 'video') {
    const video = doc.createElement('video');
    video.className = className;
    video.src = item.src;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.setAttribute('aria-label', item.alt);
    return video;
  }
  const img = doc.createElement('img');
  img.className = className;
  img.src = item.src;
  img.alt = item.alt;
  img.decoding = 'async';
  return img;
}

/**
 * Mount a gallery into `root`.
 *
 * @param {HTMLElement} root
 * @param {object} options
 * @param {Array} options.media                     [{id, src, alt, kind, order}]
 * @param {Record<string,string[]>} [options.variantMedia]
 * @param {string} [options.defaultHeroId]
 * @param {boolean} [options.reducedMotion]         defaults to prefers-reduced-motion
 * @param {string} [options.label]                  accessible name for the thumbnail list
 * @param {(state: object) => void} [options.onChange]
 */
export function variantGallery(root, options = {}) {
  if (!root || typeof root.appendChild !== 'function') {
    throw new TypeError('variantGallery requires a root element');
  }
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  let state = createInitialState(options);
  let reducedMotion =
    typeof options.reducedMotion === 'boolean' ? options.reducedMotion : detectReducedMotion(win);
  const onChange = typeof options.onChange === 'function' ? options.onChange : null;

  root.classList.add('vg');
  root.replaceChildren();

  const hero = doc.createElement('figure');
  hero.className = 'vg-hero';
  hero.setAttribute('role', 'group');
  hero.setAttribute('aria-roledescription', 'gallery hero');
  hero.setAttribute('aria-live', 'polite');

  const list = doc.createElement('ul');
  list.className = 'vg-thumbs';
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', options.label ?? 'Media thumbnails');

  const buttons = state.media.map((item, index) => {
    const li = doc.createElement('li');
    li.className = 'vg-thumb';
    li.setAttribute('role', 'option');
    li.dataset.mediaId = item.id;
    li.dataset.index = String(index);
    li.setAttribute('aria-label', item.alt);
    const thumb = createMediaElement(doc, item, 'vg-thumb-media');
    // The option carries the name; hide the inner media from assistive tech.
    thumb.setAttribute('aria-hidden', 'true');
    if (item.kind === 'image') thumb.alt = '';
    li.appendChild(thumb);
    if (item.kind === 'video') li.dataset.kind = 'video';
    list.appendChild(li);
    return li;
  });

  // Inner wrapper: the root is the size container, so layout lives one level down.
  const layout = doc.createElement('div');
  layout.className = 'vg-layout';
  layout.append(hero, list);
  root.append(layout);

  let renderedHeroId;
  function render(moveFocus) {
    root.dataset.reducedMotion = String(reducedMotion);
    const heroItem = getHero(state);
    if (state.heroId !== renderedHeroId) {
      renderedHeroId = state.heroId;
      hero.replaceChildren();
      if (heroItem) {
        const el = createMediaElement(doc, heroItem, 'vg-hero-media');
        if (heroItem.kind === 'video') el.controls = true;
        hero.appendChild(el);
        hero.dataset.mediaId = heroItem.id;
        hero.setAttribute('aria-label', heroItem.alt);
      } else {
        delete hero.dataset.mediaId;
        hero.setAttribute('aria-label', 'No media');
      }
    }
    if (state.selectedVariant == null) delete root.dataset.selectedVariant;
    else root.dataset.selectedVariant = state.selectedVariant;
    buttons.forEach((li, index) => {
      li.tabIndex = index === state.focusIndex ? 0 : -1;
      li.setAttribute('aria-selected', String(li.dataset.mediaId === state.heroId));
    });
    if (moveFocus && buttons[state.focusIndex]) buttons[state.focusIndex].focus();
  }

  function dispatch(action, moveFocus = false) {
    const next = reduce(state, action);
    if (next === state) return false;
    state = next;
    render(moveFocus);
    onChange?.(state);
    return true;
  }

  function indexOf(target) {
    const li = target?.closest?.('.vg-thumb');
    return li && list.contains(li) ? Number(li.dataset.index) : -1;
  }

  function onKeyDown(event) {
    const index = indexOf(event.target);
    if (index === -1) return;
    const type = KEY_ACTIONS[event.key];
    if (type) {
      event.preventDefault();
      if (state.focusIndex !== index) dispatch({ type: 'focus', index });
      dispatch({ type }, true);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      dispatch({ type: 'show', mediaId: state.media[index].id }, true);
    }
  }

  function onClick(event) {
    const index = indexOf(event.target);
    if (index !== -1) dispatch({ type: 'show', mediaId: state.media[index].id }, true);
  }

  function onFocusIn(event) {
    const index = indexOf(event.target);
    if (index !== -1) dispatch({ type: 'focus', index });
  }

  list.addEventListener('keydown', onKeyDown);
  list.addEventListener('click', onClick);
  list.addEventListener('focusin', onFocusIn);

  render(false);

  const api = {
    /** Explicitly select a variant. The hero only changes through calls like this. */
    select(variantId) {
      dispatch({ type: 'select', variantId });
      return api;
    },
    /** Explicitly show a media item by id (same as activating its thumbnail). */
    show(mediaId) {
      dispatch({ type: 'show', mediaId });
      return api;
    },
    set selectedVariant(variantId) {
      api.select(variantId);
    },
    get selectedVariant() {
      return state.selectedVariant;
    },
    get heroId() {
      return state.heroId;
    },
    get reducedMotion() {
      return reducedMotion;
    },
    setReducedMotion(value) {
      reducedMotion = Boolean(value);
      render(false);
      return api;
    },
    getState() {
      return state;
    },
    destroy() {
      list.removeEventListener('keydown', onKeyDown);
      list.removeEventListener('click', onClick);
      list.removeEventListener('focusin', onFocusIn);
      root.replaceChildren();
      root.classList.remove('vg');
      delete root.dataset.reducedMotion;
      delete root.dataset.selectedVariant;
    },
  };
  return api;
}

export default variantGallery;
