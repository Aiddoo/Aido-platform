/**
 * @aido/vitest-config
 *
 * 공유 Vitest 설정 프리셋
 * packages/* 에서 확장하여 사용
 *
 * @example
 * // packages/utils/vitest.config.ts
 * import { defineConfig, mergeConfig } from 'vitest/config';
 * import baseConfig from '@aido/vitest-config';
 *
 * export default mergeConfig(baseConfig, defineConfig({
 *   test: { root: './src' },
 * }));
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 전역 API (describe, it, expect)
    globals: true,

    // 테스트 환경
    environment: 'node',

    // 테스트 파일 패턴
    include: ['**/*.{test,spec}.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],

    // 커버리지 설정 (v8 provider - 2025년 표준)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      exclude: ['**/*.d.ts', '**/index.ts', '**/*.spec.ts', '**/*.test.ts'],
    },

    // 클린업
    clearMocks: true,
    restoreMocks: true,
  },
});
