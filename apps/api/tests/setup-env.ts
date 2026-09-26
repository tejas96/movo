import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Load .env.test into process.env before anything reads it. No dotenv dependency at runtime.
const file = resolve(__dirname, '../.env.test');
for (const line of readFileSync(file, 'utf8').split('\n')) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m?.[1]) process.env[m[1]] = m[2] ?? '';
}
