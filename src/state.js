// Pure, deterministic state machine for the variant gallery.
// No DOM, no timers, no network: every transition is a function of (state, action).

const KINDS = new Set(['image', 'video']);

/**
 * Validate and order media. Sort by `order` ascending; ties keep input order.
 * @param {Array<{id: string, src: string, alt: string, kind: 'image'|'video', order: number}>} media
 */
export function normalizeMedia(media) {
  if (!Array.isArray(media)) throw new TypeError('media must be an array');
  const seen = new Set();
  const indexed = media.map((item, index) => {
    if (!item || typeof item.id !== 'string' || item.id === '') {
      throw new TypeError(`media[${index}].id must be a non-empty string`);
    }
    if (seen.has(item.id)) throw new Error(`duplicate media id "${item.id}"`);
    seen.add(item.id);
    if (!KINDS.has(item.kind)) {
      throw new TypeError(`media "${item.id}" has invalid kind "${item.kind}"`);
    }
    if (typeof item.src !== 'string') throw new TypeError(`media "${item.id}" src must be a string`);
    if (typeof item.alt !== 'string') throw new TypeError(`media "${item.id}" alt must be a string`);
    const order = Number.isFinite(item.order) ? item.order : Number.POSITIVE_INFINITY;
    return { item: Object.freeze({ ...item }), order, index };
  });
  indexed.sort((a, b) => (a.order === b.order ? a.index - b.index : a.order < b.order ? -1 : 1));
  return Object.freeze(indexed.map((entry) => entry.item));
}

/**
 * Build the initial state. The hero is `defaultHeroId`; it is never derived from
 * any variant. If `defaultHeroId` is absent or unknown, the first media item in
 * order is used (or null when there is no media).
 */
export function createInitialState({ media, variantMedia = {}, defaultHeroId } = {}) {
  const ordered = normalizeMedia(media ?? []);
  const ids = ordered.map((m) => m.id);
  const variants = {};
  for (const [variantId, list] of Object.entries(variantMedia ?? {})) {
    if (!Array.isArray(list)) throw new TypeError(`variantMedia["${variantId}"] must be an array`);
    // Keep only known media, in gallery order (media order is authoritative).
    const wanted = new Set(list);
    variants[variantId] = Object.freeze(ids.filter((id) => wanted.has(id)));
  }
  const heroId = defaultHeroId != null && ids.includes(defaultHeroId) ? defaultHeroId : (ids[0] ?? null);
  return Object.freeze({
    media: ordered,
    variantMedia: Object.freeze(variants),
    heroId,
    selectedVariant: null,
    focusIndex: heroId == null ? -1 : ids.indexOf(heroId),
  });
}

function withChanges(state, changes) {
  let changed = false;
  for (const key of Object.keys(changes)) {
    if (state[key] !== changes[key]) changed = true;
  }
  return changed ? Object.freeze({ ...state, ...changes }) : state;
}

/**
 * Transition function. Returns the same object when nothing changed.
 *
 * Actions:
 *   { type: 'select', variantId }   explicit variant selection; hero becomes the
 *                                   variant's first media. A variant with no
 *                                   (known) media leaves the hero unchanged.
 *   { type: 'show', mediaId }       explicit activation of a thumbnail.
 *   { type: 'focus', index }        move roving focus (clamped); hero unchanged.
 *   { type: 'focusNext' | 'focusPrev' | 'focusFirst' | 'focusLast' }
 */
export function reduce(state, action) {
  const count = state.media.length;
  switch (action?.type) {
    case 'select': {
      const { variantId } = action;
      const list = Object.prototype.hasOwnProperty.call(state.variantMedia, variantId)
        ? state.variantMedia[variantId]
        : [];
      if (list.length === 0) return withChanges(state, { selectedVariant: variantId ?? null });
      const heroId = list[0];
      return withChanges(state, {
        selectedVariant: variantId,
        heroId,
        focusIndex: state.media.findIndex((m) => m.id === heroId),
      });
    }
    case 'show': {
      const index = state.media.findIndex((m) => m.id === action.mediaId);
      if (index === -1) return state;
      return withChanges(state, { heroId: action.mediaId, focusIndex: index });
    }
    case 'focus': {
      if (count === 0) return state;
      const index = Math.min(Math.max(Math.trunc(action.index) || 0, 0), count - 1);
      return withChanges(state, { focusIndex: index });
    }
    case 'focusNext':
      return count === 0 ? state : withChanges(state, { focusIndex: (state.focusIndex + 1) % count });
    case 'focusPrev':
      return count === 0 ? state : withChanges(state, { focusIndex: (state.focusIndex - 1 + count) % count });
    case 'focusFirst':
      return count === 0 ? state : withChanges(state, { focusIndex: 0 });
    case 'focusLast':
      return count === 0 ? state : withChanges(state, { focusIndex: count - 1 });
    default:
      return state;
  }
}

export function getHero(state) {
  return state.media.find((m) => m.id === state.heroId) ?? null;
}
