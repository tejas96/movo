import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

const swcPlugin = swc.vite({
  jsc: {
    parser: { syntax: 'typescript', decorators: true },
    transform: { legacyDecorator: true, decoratorMetadata: true },
    target: 'es2022',
  },
  module: { type: 'es6' },
});

export default defineConfig({
  plugins: [swcPlugin],
  test: {
    projects: [
      { plugins: [swcPlugin], test: { name: 'unit', include: ['src/**/*.spec.ts'] } },
      {
        plugins: [swcPlugin],
        test: {
          name: 'e2e',
          include: ['tests/**/*.e2e.ts'],
          setupFiles: ['tests/setup-env.ts'],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
