/**
 * Builds preview/dist/index.html from preview/template.html.
 * - Injects every token as a CSS custom property (--color-light-bg-card, --radius-xl, ...).
 * - Embeds Poppins as base64 so the file opens anywhere without a server.
 * - Injects an SVG sprite with every MOVO icon in linear and bold styles.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const jiti = createJiti(import.meta.url);
const { tokens } = await jiti.import(resolve(root, 'src/tokens/index.ts'));
const { iconData } = await jiti.import(resolve(root, 'src/icons/generated/icon-data.ts'));

const kebab = (s) =>
  s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .toLowerCase();

const unit = (path, value) => {
  if (typeof value === 'string') return value;
  const last = path[path.length - 1] ?? '';
  if (/weight|opacity|elevation/i.test(last)) return String(value);
  if (/duration/i.test(path.join('.'))) return `${value}ms`;
  return `${value}px`;
};

const vars = [];
const walk = (obj, path) => {
  for (const [key, value] of Object.entries(obj)) {
    const next = [...path, kebab(key)];
    if (value !== null && typeof value === 'object') {
      if (path[0] === 'elevation' && key === 'native') continue;
      walk(value, next);
    } else {
      vars.push(`  --${next.join('-')}: ${unit(next, value)};`);
    }
  }
};
walk(tokens, []);

const fontFace = (weight, file) => {
  const data = readFileSync(resolve(root, 'assets/fonts', file)).toString('base64');
  return `@font-face{font-family:'Poppins';font-weight:${weight};font-style:normal;font-display:swap;src:url(data:font/ttf;base64,${data}) format('truetype');}`;
};
const fonts = [
  fontFace(400, 'Poppins-Regular.ttf'),
  fontFace(500, 'Poppins-Medium.ttf'),
  fontFace(600, 'Poppins-SemiBold.ttf'),
  fontFace(700, 'Poppins-Bold.ttf'),
].join('\n');

const symbols = [];
for (const [name, styles] of Object.entries(iconData)) {
  for (const [style, nodes] of Object.entries(styles)) {
    const body = nodes
      .map(
        (n) =>
          `<${n.tag} ${Object.entries(n.attrs)
            .map(([k, v]) => `${k}="${v}"`)
            .join(' ')}/>`,
      )
      .join('');
    symbols.push(`<symbol id="ix-${name}-${style}" viewBox="0 0 24 24">${body}</symbol>`);
  }
}
const sprite = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${symbols.join('')}</svg>`;

const iconList = Object.keys(iconData)
  .map(
    (name) =>
      `<div class="icon-cell"><svg class="ix"><use href="#ix-${name}-linear"/></svg><svg class="ix"><use href="#ix-${name}-bold"/></svg><span>${name}</span></div>`,
  )
  .join('');

const template = readFileSync(resolve(root, 'preview/template.html'), 'utf8');
const html = template
  .replace('/*__TOKENS__*/', vars.join('\n'))
  .replace('/*__FONTS__*/', fonts)
  .replace('<!--__ICONS__-->', sprite)
  .replace('<!--__ICON_LIST__-->', iconList);

const outDir = resolve(root, 'preview/dist');
mkdirSync(outDir, { recursive: true });
const out = resolve(outDir, 'index.html');
writeFileSync(out, html);
console.log(
  `wrote ${out} (${(html.length / 1024).toFixed(0)} KB, ${vars.length} css vars, ${symbols.length} icon symbols)`,
);
