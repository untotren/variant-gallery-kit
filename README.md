A dependency-free media gallery with explicit selection state, responsive layout, keyboard navigation, and reduced-motion support.

## Usage

```html
<link rel="stylesheet" href="src/variant-gallery.css" />
<div id="gallery"></div>
<script type="module">
  import { variantGallery } from './src/variantGallery.js';

  const gallery = variantGallery(document.getElementById('gallery'), {
    media: [
      { id: 'a', src: 'a.svg', alt: 'Front view', kind: 'image', order: 1 },
      { id: 'b', src: 'b.mp4', alt: 'Turntable clip', kind: 'video', order: 2 },
    ],
    variantMedia: { blue: ['b'] }, // optional
    defaultHeroId: 'a',
  });

  gallery.select('blue');           // explicit selection
  gallery.selectedVariant = 'blue'; // same, as a setter
</script>
```

### Options

| option          | meaning                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------- |
| `media`         | `[{id, src, alt, kind: 'image'\|'video', order}]`; rendered sorted by `order` (ties keep input order) |
| `variantMedia`  | optional `Record<variantId, mediaId[]>`                                                   |
| `defaultHeroId` | initial hero. If absent/unknown, the first media item in order (never a variant's media)  |
| `reducedMotion` | boolean; defaults to `prefers-reduced-motion: reduce`                                     |
| `label`         | accessible name for the thumbnail list (default `"Media thumbnails"`)                     |
| `onChange`      | called with the new state after every transition                                          |

### Behaviour

- The hero changes only through an explicit action: `select(variantId)` / the
  `selectedVariant` setter, `show(mediaId)`, or activating a thumbnail (Enter,
  Space, click). Focus movement never changes the hero.
- `select()` sets the hero to the variant's first media in gallery order. A
  variant with no known media records `selectedVariant` but leaves the hero unchanged.
- Thumbnails use a roving tabindex: Arrow keys move (and wrap), Home/End jump.
- The hero is a `<figure role="group">` whose `aria-label` is the media `alt`.
- Reduced motion sets `data-reduced-motion="true"` on the root, which disables
  all transitions/animations; the OS preference is also honoured in CSS.
- Layout: a container query on the root puts the thumbnail strip below the
  hero under 40rem and beside it at 40rem and wider.
- No network calls are made by the module.

The pure state machine is available separately from `src/state.js`
(`createInitialState`, `reduce`, `getHero`, `normalizeMedia`).

## Development

```sh
npm install
npm test              # node --test with jsdom
npm run fixtures      # regenerate fixtures/*.svg and fixtures/media.json
npx serve .           # then open /demo/
```

Fixtures are solid-colour SVG swatches with fictional labels.
