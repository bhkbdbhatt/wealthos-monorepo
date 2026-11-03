import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.e2e-spec.ts'],
    environment: 'node',
    globals: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
    fileParallelism: false,
  },
});
