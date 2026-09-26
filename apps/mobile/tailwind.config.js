/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{ts,tsx}', '../../packages/design-system/src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset'), require('@movo/design-system/tailwind-preset')],
  theme: {},
  plugins: [],
};
