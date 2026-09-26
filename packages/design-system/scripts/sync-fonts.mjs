/** Copies the four Poppins weights from @expo-google-fonts/poppins into assets/fonts with React Native friendly names. */
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const require = createRequire(import.meta.url);
const pkgDir = dirname(require.resolve('@expo-google-fonts/poppins/package.json'));
const weights = [
  ['400Regular', 'Poppins-Regular.ttf'],
  ['500Medium', 'Poppins-Medium.ttf'],
  ['600SemiBold', 'Poppins-SemiBold.ttf'],
  ['700Bold', 'Poppins-Bold.ttf'],
];
const outDir = resolve(root, 'assets/fonts');
mkdirSync(outDir, { recursive: true });
for (const [folder, target] of weights) {
  const dir = resolve(pkgDir, folder);
  const ttf = readdirSync(dir).find((f) => f.endsWith('.ttf'));
  if (!ttf) throw new Error(`no ttf in ${dir}`);
  copyFileSync(resolve(dir, ttf), resolve(outDir, target));
  console.log(`copied ${folder}/${ttf} -> assets/fonts/${target}`);
}
copyFileSync(resolve(pkgDir, 'LICENSE_FONT'), resolve(outDir, 'OFL-Poppins.txt'));
