/**
 * Reads the icons named in src/icons/icon-map.ts from the `iconsax` package (free set)
 * and writes src/icons/generated/icon-data.ts.
 *
 * Only what the app ships is written:
 * - an icon is kept when its MOVO name appears as a string literal ('bell', "bell") in
 *   apps/mobile/src or packages/design-system/src, or is listed in KEEP below;
 * - the `bold` style is kept only for the names in `boldIcons` (icon-map.ts). TypeScript
 *   enforces that list: a bold icon outside it does not compile.
 *
 * Data is compact: colours are normalised to currentColor, and the attributes every node of a
 * style shares (STYLE_DEFAULTS, mirrored in src/icons/expand.ts) are left out. A node is its
 * path `d` string, or an object with the attributes that differ (null = attribute absent).
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const repo = resolve(root, '../..');
const require = createRequire(import.meta.url);
const manifestPath = require.resolve('iconsax/manifest.json');
const dataDir = resolve(dirname(manifestPath), 'data');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const jiti = createJiti(import.meta.url);
const { iconMap, boldIcons } = await jiti.import(resolve(root, 'src/icons/icon-map.ts'));
const { STYLE_DEFAULTS } = await jiti.import(resolve(root, 'src/icons/expand.ts'));

/** Icons used only through names built at runtime (none today). The scan cannot see those. */
const KEEP = [];

/** Folders scanned for icon names. features/ar is read, never written. */
const SCAN_DIRS = ['apps/mobile/src', 'packages/design-system/src'];
const SKIP = new Set(['node_modules', 'generated']);
const SKIP_FILES = new Set([resolve(root, 'src/icons/icon-map.ts')]);

const COLOR_RE = /^(#292d32|#fff(fff)?|white|#000(000)?|black|currentcolor)$/i;
const ELEMENT_RE = /<(path|circle|rect|line|polyline|polygon|ellipse)\b([^>]*?)\/?>/g;
const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*"([^"]*)"/g;
const ATTRS = new Set([
  'd',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'width',
  'height',
  'points',
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'fill-rule',
  'clip-rule',
  'opacity',
  'fill-opacity',
  'stroke-opacity',
  'transform',
]);

const sources = [];
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    if (SKIP.has(f)) continue;
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx|js|mjs)$/.test(f) && !SKIP_FILES.has(p))
      sources.push(readFileSync(p, 'utf8'));
  }
};
for (const d of SCAN_DIRS) walk(resolve(repo, d));
const source = sources.join('\n');
const literals = new Set(
  [...source.matchAll(/['"`]([a-zA-Z][a-zA-Z0-9]*)['"`]/g)].map((m) => m[1]),
);

const bold = new Set(boldIcons);
const used = Object.keys(iconMap).filter((n) => literals.has(n) || KEEP.includes(n) || bold.has(n));
const unknown = [...KEEP, ...bold].filter((n) => !(n in iconMap));
if (unknown.length) {
  console.error(`Not in icon-map.ts: ${unknown.join(', ')}`);
  process.exit(1);
}

const categoryCache = new Map();
const loadCategory = (category) => {
  if (!categoryCache.has(category)) {
    categoryCache.set(
      category,
      JSON.parse(readFileSync(resolve(dataDir, `${category}.json`), 'utf8')),
    );
  }
  return categoryCache.get(category);
};

/** Full attribute set per node, as the renderer sees it. */
const parseSvg = (svg) => {
  const rootFill = /<svg\b[^>]*\bfill="([^"]*)"/.exec(svg)?.[1] ?? 'none';
  const body = svg.replace(/<defs>[\s\S]*?<\/defs>/g, '').replace(/<mask[\s\S]*?<\/mask>/g, '');
  const nodes = [];
  for (const m of body.matchAll(ELEMENT_RE)) {
    const tag = m[1];
    const attrs = {};
    for (const a of m[2].matchAll(ATTR_RE)) {
      const [, k, v] = a;
      if (!ATTRS.has(k)) continue;
      attrs[k] = (k === 'fill' || k === 'stroke') && COLOR_RE.test(v) ? 'currentColor' : v;
    }
    if (tag === 'rect' && attrs.width === '24' && attrs.height === '24' && !attrs.rx) continue; // clip helper
    if (!('fill' in attrs)) attrs.fill = rootFill === 'none' ? 'none' : 'currentColor';
    nodes.push({ tag, attrs });
  }
  return nodes;
};

/** Drops the style's shared attributes; a plain path with nothing else left becomes its `d`. */
const compact = (node, style) => {
  const defaults = STYLE_DEFAULTS[style];
  const out = {};
  if (node.tag !== 'path') out.tag = node.tag;
  for (const [k, v] of Object.entries(node.attrs)) if (defaults[k] !== v) out[k] = v;
  for (const k of Object.keys(defaults)) if (!(k in node.attrs)) out[k] = null;
  const keys = Object.keys(out);
  return keys.length === 1 && keys[0] === 'd' ? out.d : out;
};

const out = {};
const missing = [];
for (const name of used) {
  const iconsaxName = iconMap[name];
  const entry = manifest[iconsaxName];
  if (!entry) {
    missing.push(`${name} -> ${iconsaxName}`);
    continue;
  }
  const svgs = loadCategory(entry.category)[iconsaxName];
  out[name] = {};
  for (const style of bold.has(name) ? ['linear', 'bold'] : ['linear']) {
    const svg = svgs?.[style];
    if (!svg) {
      missing.push(`${name} -> ${iconsaxName} (${style})`);
      continue;
    }
    out[name][style] = parseSvg(svg).map((n) => compact(n, style));
  }
}
if (missing.length) {
  console.error(`Missing icons:\n  ${missing.join('\n  ')}`);
  process.exit(1);
}

const union = (names) => (names.length ? names.map((n) => `'${n}'`).join(' | ') : 'never');
const boldNames = used.filter((n) => bold.has(n));
const entries = Object.entries(out)
  .map(([name, styles]) => `${name}:${JSON.stringify(styles)}`)
  .join(',\n');
const file = resolve(root, 'src/icons/generated/icon-data.ts');
const text = `/* Generated by scripts/build-icons.mjs from the Iconsax free set. Do not edit. Run \`pnpm --filter @movo/design-system icons\`. */
import type { IconNodeData } from '../types';

/** Icons the app uses. Add a name to icon-map.ts, use it, then run the script. */
export type IconName = ${union(used)};

/** Icons shipped with the filled style too (\`boldIcons\` in icon-map.ts). */
export type BoldIconName = ${union(boldNames)};

export const iconData: {
  readonly [K in IconName]: {
    readonly linear: readonly IconNodeData[];
    readonly bold?: readonly IconNodeData[];
  };
} = {
${entries},
};
`;
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, text);
const dropped = Object.keys(iconMap).filter((n) => !used.includes(n));
console.log(
  `wrote ${relative(repo, file)}: ${used.length} icons (${boldNames.length} with bold), ${text.length} bytes`,
);
if (dropped.length) console.log(`not shipped (unused): ${dropped.join(', ')}`);
const idleBold = boldNames.filter((n) => !literals.has(n));
if (idleBold.length) console.warn(`boldIcons not used anywhere: ${idleBold.join(', ')}`);
