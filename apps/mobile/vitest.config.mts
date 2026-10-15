import { defineConfig } from 'vitest/config';

/** Unit tests for pure helpers only (no React Native runtime). Screens are checked by hand. */
export default defineConfig({ test: { include: ['src/**/*.test.ts'] } });
