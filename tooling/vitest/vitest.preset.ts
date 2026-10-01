import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.{test,spec}.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      exclude: ['**/*.d.ts', '**/index.ts', '**/*.spec.ts', '**/*.test.ts'],
    },
    clearMocks: true,
    restoreMocks: true,
  },
});
