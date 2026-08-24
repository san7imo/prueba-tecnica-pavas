import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    fileParallelism: false,
    hookTimeout: 30000,
    setupFiles: './tests/setupEnv.js',
  },
});
