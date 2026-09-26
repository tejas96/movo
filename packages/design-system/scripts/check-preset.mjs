import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const preset = require('../tailwind.preset.js');
const ext = preset.theme?.extend;
if (!ext?.colors?.ink?.DEFAULT || !ext.fontSize?.body || !ext.borderRadius?.xl) {
  throw new Error('tailwind.preset.js is missing expected keys');
}
console.log('preset ok');
console.log('  bg-ink       =', ext.colors.ink.DEFAULT);
console.log('  bg-card      =', ext.colors.card.DEFAULT);
console.log('  text-body    =', JSON.stringify(ext.fontSize.body));
console.log('  rounded-xl   =', ext.borderRadius.xl);
console.log('  font-sans    =', ext.fontFamily.sans.join(', '));
