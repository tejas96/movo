#!/usr/bin/env node
// Feature boundaries for apps/mobile/src.
//
// Rule: a file in features/<a>/ may import from core/, packages and features/<a>/ only.
// core/ may not import from features/ at all. Code that two features share lives in core/.
// The only exceptions are the central registries below, which list every feature by design.
//
// Run: pnpm --filter @movo/mobile check-boundaries
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

/** [importing file, target pattern (path under src/, no extension), why]. */
const ALLOW = [
  ['core/navigation/registry.ts', /^features\/[a-z-]+\/routes$/, 'route registry'],
  ['core/navigation/ar-routes.tsx', /^features\/ar\/[A-Za-z]+Screen$/, 'AR route entry'],
  ['core/navigation/MainTabs.tsx', /^features\/[a-z-]+\/[A-Za-z]+Screen$/, 'bottom tabs'],
  ['features/home/registry.ts', /^features\/[a-z-]+\/home$/, 'home registry'],
];

const IMPORT_RE = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

const posix = (p) => p.split(sep).join('/');

/** Path under src/ without extension, or null for packages and files outside src/. */
function target(file, spec) {
  let abs;
  if (spec.startsWith('@/')) abs = join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) abs = normalize(join(dirname(file), spec));
  else return null;
  const rel = posix(relative(SRC, abs));
  if (rel.startsWith('..')) return null;
  return rel.replace(/\.(ts|tsx|js|jsx|json)$/, '').replace(/\/index$/, '');
}

const area = (rel) => {
  const m = /^features\/([^/]+)\//.exec(`${rel}/`);
  return m ? `features/${m[1]}` : rel.startsWith('core/') ? 'core' : 'other';
};

const problems = [];
for (const file of walk(SRC)) {
  const from = posix(relative(SRC, file));
  const fromArea = area(from);
  const code = readFileSync(file, 'utf8');
  for (const m of code.matchAll(IMPORT_RE)) {
    const to = target(file, m[1]);
    if (!to?.startsWith('features/')) continue;
    const toArea = area(to);
    if (toArea === fromArea) continue;
    if (ALLOW.some(([f, re]) => f === from && re.test(to))) continue;
    const line = code.slice(0, m.index).split('\n').length;
    problems.push(`  src/${from}:${line}  imports  ${m[1]}  (${toArea})`);
  }
}

if (problems.length) {
  console.error(
    `Feature boundary check failed: ${problems.length} import(s) cross a feature boundary.\n\n` +
      `${problems.join('\n')}\n\n` +
      'A feature may import only from core/, @movo/* packages and its own folder, and core/\n' +
      'may not import features. Move code that two features share to core/ (same code, new\n' +
      'path). Registries that list every feature are allowed in scripts/check-boundaries.mjs.',
  );
  process.exit(1);
}
console.log('Feature boundaries OK.');
