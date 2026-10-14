/**
 * Finds translation keys nobody uses and keys the code asks for that do not exist.
 * English (src/locales/en) is the source of truth; resources.test.ts keeps hi and mr in shape.
 *
 * A key counts as used when the app, the API (push text) or the contracts mention it:
 * - as a full string: 'money:status.PAID', or a group such as labels="money:status"
 *   (a group marks every key under it);
 * - as a bare string ('title', `status.${s}`) in a file that reads that namespace through
 *   useTranslation('ns' | ['ns', ...]), getFixedT(_, 'ns') or useTranslation() (= common);
 * - as the fixed start of a template (`money:method.${m}`): every key under that start;
 * - under one of DYNAMIC_PREFIXES, for keys built from data the scan cannot read.
 * Plural forms (_one, _other, ...) count as their base key.
 *
 * Missing: a t('…') / i18n.t('…') key, a labels="…" group or a template start that matches
 * no key. A missing key with a defaultValue is only a warning (it shows English in every
 * language, but nothing breaks). Exit code 1 when anything is unused or missing.
 *
 * Usage: pnpm --filter @movo/i18n check-keys
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = resolve(here, '..');
const repo = resolve(pkg, '../..');

/** Code that reads translations. AR and the API are only read. */
const SOURCES = [
  'apps/mobile/src',
  'apps/mobile/App.tsx',
  'apps/api/src',
  'packages/contracts/src',
];
const SKIP_DIRS = new Set(['node_modules', 'generated', 'dist', '__tests__']);
const SKIP_FILE = /\.(test|spec|e2e-spec)\.tsx?$/;

/**
 * Keys built from data the scan cannot follow. Keep each entry narrow and say where it is built.
 */
const DYNAMIC_PREFIXES = [
  // apps/api: error codes from the server, shown by core/api/use-error-message.ts.
  'errors:',
  // apps/mobile/src/features/manage/ModuleSettingsScreen.tsx: `${module}.${field}.label`
  // with i18nKey() turning dots into underscores.
  'manage:moduleSettings.',
];

/** Namespaces owned by another track: checked for missing keys, not for unused ones. */
const OWNED_ELSEWHERE = ['ar'];

/** Unused today but kept on purpose. Say why. */
const KEEP = [
  // The AR screens ask for common:back and common:close with an English defaultValue;
  // these are the keys they should use.
  'common:actions.back',
  'common:actions.close',
];

const PLURAL = /_(zero|one|two|few|many|other)$/;

// ---- keys ----
const enDir = resolve(pkg, 'src/locales/en');
const NAMESPACES = readdirSync(enDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.slice(0, -5));
const leaves = new Set(); // ns:a.b (plural suffix removed)
const branches = new Set(); // ns:a
const flatten = (ns, obj, path) => {
  for (const [k, v] of Object.entries(obj)) {
    const key = path ? `${path}.${k}` : k;
    if (v && typeof v === 'object') {
      branches.add(`${ns}:${key}`);
      flatten(ns, v, key);
    } else {
      leaves.add(`${ns}:${key.replace(PLURAL, '')}`);
    }
  }
};
for (const ns of NAMESPACES)
  flatten(ns, JSON.parse(readFileSync(join(enDir, `${ns}.json`), 'utf8')), '');

// ---- sources ----
const files = [];
const walk = (p) => {
  const st = statSync(p);
  if (st.isDirectory()) {
    for (const f of readdirSync(p)) if (!SKIP_DIRS.has(f)) walk(join(p, f));
  } else if (/\.(ts|tsx)$/.test(p) && !SKIP_FILE.test(p)) {
    files.push(p);
  }
};
for (const s of SOURCES) walk(resolve(repo, s));

const NS_ALT = NAMESPACES.join('|');
const used = new Set();
const usedPrefixes = new Set(DYNAMIC_PREFIXES);
const missing = [];
const fallbacks = [];

/**
 * String and template literals of a TS file, nested templates included. For a template with
 * expressions, `head` is the text before the first ${…}.
 */
function literals(src) {
  const out = [];
  let i = 0;
  const n = src.length;
  const stack = []; // templates whose ${…} is open
  const readQuoted = (q) => {
    let v = '';
    i++;
    while (i < n && src[i] !== q && src[i] !== '\n') {
      if (src[i] === '\\') {
        v += src[i + 1] ?? '';
        i += 2;
      } else v += src[i++];
    }
    i++;
    return v;
  };
  // Scans template text from i until ` (end) or ${ (expression).
  const readTemplateText = (tpl) => {
    while (i < n) {
      const c = src[i];
      if (c === '\\') {
        if (!tpl.expr) tpl.head += src[i + 1] ?? '';
        i += 2;
      } else if (c === '`') {
        i++;
        out.push({ head: tpl.head, expr: tpl.expr });
        return 'end';
      } else if (c === '$' && src[i + 1] === '{') {
        i += 2;
        tpl.expr = true;
        return 'expr';
      } else {
        if (!tpl.expr) tpl.head += c;
        i++;
      }
    }
    return 'end';
  };
  let depth = 0; // brace depth inside the innermost ${…}
  const depths = [];
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++;
    } else if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end === -1 ? n : end + 2;
    } else if (c === "'" || c === '"') {
      out.push({ head: readQuoted(c), expr: false });
    } else if (c === '`') {
      i++;
      const tpl = { head: '', expr: false };
      if (readTemplateText(tpl) === 'expr') {
        stack.push(tpl);
        depths.push(depth);
        depth = 0;
      }
    } else if (c === '{') {
      depth++;
      i++;
    } else if (c === '}') {
      if (depth === 0 && stack.length) {
        i++;
        const tpl = stack[stack.length - 1];
        if (readTemplateText(tpl) === 'end') {
          stack.pop();
          depth = depths.pop() ?? 0;
        }
      } else {
        depth--;
        i++;
      }
    } else {
      i++;
    }
  }
  return out;
}

const exists = (key) => leaves.has(key) || branches.has(key);
const startsAnyKey = (prefix) =>
  [...leaves].some((k) => k.startsWith(prefix)) || [...branches].some((k) => k.startsWith(prefix));
const KEYISH = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)*$/;

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const where = relative(repo, file);

  // Namespaces this file reads without a prefix.
  const context = new Set();
  for (const m of src.matchAll(/useTranslation\(\s*([^)]*?)\s*\)/g)) {
    const arg = m[1];
    if (!arg) context.add('common');
    for (const n of arg.matchAll(/['"]([a-z]+)['"]/g)) context.add(n[1]);
  }
  for (const m of src.matchAll(/getFixedT\([^,]*,\s*(\[[^\]]*\]|['"][a-z]+['"])/g)) {
    for (const n of m[1].matchAll(/['"]([a-z]+)['"]/g)) context.add(n[1]);
  }
  if (/\bi18n\.t\(/.test(src)) context.add('common');

  const mark = (key) => {
    used.add(key);
  };
  const markBare = (key) => {
    for (const ns of context) mark(`${ns}:${key}`);
  };

  for (const tok of literals(src)) {
    if (tok.expr) {
      // A template with ${…}: everything under its fixed start counts as used.
      const start = tok.head;
      if (!start) continue;
      if (new RegExp(`^(${NS_ALT}):`).test(start)) usedPrefixes.add(start);
      else if (/^[A-Za-z][A-Za-z0-9_.]*$/.test(start))
        for (const ns of context) usedPrefixes.add(`${ns}:${start}`);
    } else if (new RegExp(`^(${NS_ALT}):.+$`).test(tok.head)) {
      mark(tok.head);
    } else if (KEYISH.test(tok.head)) {
      markBare(tok.head);
    }
  }

  // Missing: literal t() keys, labels groups and template starts that match nothing.
  const check = (key, line, withDefault = false) => {
    const full = new RegExp(`^(${NS_ALT}):`).test(key);
    const candidates = full ? [key] : [...context].map((ns) => `${ns}:${key}`);
    if (candidates.length && !candidates.some(exists))
      (withDefault ? fallbacks : missing).push(`${where}:${line}  ${key}`);
  };
  const lineOf = (index) => src.slice(0, index).split('\n').length;
  for (const m of src.matchAll(/\b(?:t|i18n\.t)\(\s*(['"])([^'"]+)\1([^)]*)/g))
    check(m[2], lineOf(m.index), /defaultValue/.test(m[3]));
  for (const m of src.matchAll(/\blabels="([^"]+)"/g)) check(m[1], lineOf(m.index));
  for (const m of src.matchAll(/\b(?:t|i18n\.t)\(\s*`([^`$]+)\$\{/g)) {
    const start = m[1];
    const full = new RegExp(`^(${NS_ALT}):`).test(start);
    const candidates = full ? [start] : [...context].map((ns) => `${ns}:${start}`);
    if (candidates.length && !candidates.some(startsAnyKey))
      missing.push(`${where}:${lineOf(m.index)}  ${start}…`);
  }
}

const isUsed = (key) => {
  if (used.has(key)) return true;
  for (const p of usedPrefixes) if (key.startsWith(p)) return true;
  // A used group covers its keys (labels="money:status", returnObjects).
  const parts = key.split('.');
  for (let i = parts.length - 1; i > 0; i--) if (used.has(parts.slice(0, i).join('.'))) return true;
  return false;
};

const unused = [...leaves]
  .filter((k) => !OWNED_ELSEWHERE.includes(k.split(':')[0]) && !KEEP.includes(k) && !isUsed(k))
  .sort();

if (fallbacks.length) {
  console.log(`Warning: ${fallbacks.length} keys missing, shown from their English defaultValue:`);
  for (const k of fallbacks) console.log(`  ${k}`);
}

if (unused.length) {
  console.log(`Unused keys (${unused.length}). Delete them from en, hi and mr, or use them:`);
  for (const k of unused) console.log(`  ${k}`);
}
if (missing.length) {
  console.log(`Missing keys (${missing.length}). The code asks for these but en has none:`);
  for (const k of missing) console.log(`  ${k}`);
}
if (unused.length || missing.length) process.exit(1);
console.log(
  `i18n keys ok: ${leaves.size} keys in ${NAMESPACES.length} namespaces, ${files.length} files scanned.`,
);
