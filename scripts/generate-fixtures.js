// Generates solid-colour SVG fixtures with fictional labels.
// Usage: node scripts/generate-fixtures.js   (output is committed in fixtures/)

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'fixtures');

export const FIXTURES = [
  { id: 'swatch-ember', label: 'Ember', fill: '#c8462b', text: '#ffffff' },
  { id: 'swatch-lagoon', label: 'Lagoon', fill: '#1f7a8c', text: '#ffffff' },
  { id: 'swatch-meadow', label: 'Meadow', fill: '#4f9d4a', text: '#ffffff' },
  { id: 'swatch-dune', label: 'Dune', fill: '#d9b26f', text: '#2a2111' },
  { id: 'swatch-dusk', label: 'Dusk', fill: '#5b4b8a', text: '#ffffff' },
  { id: 'swatch-slate', label: 'Slate', fill: '#5a6470', text: '#ffffff' },
];

function svg({ label, fill, text }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600" role="img" aria-label="${label}">
  <rect width="600" height="600" fill="${fill}"/>
  <text x="300" y="315" text-anchor="middle" font-family="sans-serif" font-size="56" fill="${text}">${label}</text>
</svg>
`;
}

mkdirSync(outDir, { recursive: true });
for (const fixture of FIXTURES) {
  writeFileSync(join(outDir, `${fixture.id}.svg`), svg(fixture));
}

const media = FIXTURES.map((f, i) => ({
  id: f.id,
  src: `../fixtures/${f.id}.svg`,
  alt: `${f.label} swatch`,
  kind: 'image',
  order: (i + 1) * 10,
}));
writeFileSync(join(outDir, 'media.json'), JSON.stringify(media, null, 2) + '\n');
console.log(`wrote ${FIXTURES.length} SVGs and media.json to ${outDir}`);
