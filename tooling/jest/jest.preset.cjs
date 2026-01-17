/**
 * @aido/jest-config
 *
 * 공유 Jest 설정 프리셋
 * 각 앱/패키지에서 확장하여 사용
 *
 * @example
 * // apps/api/jest.config.cjs
 * const preset = require('@aido/jest-config/jest.preset.cjs');
 * module.exports = { ...preset, // 오버라이드 };
 */

/** @type {import('jest').Config} */
module.exports = {
  // 기본 설정
  preset: 'ts-jest',
  testEnvironment: 'node',

  // 파일 확장자
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // 변환 설정 (ts-jest 기본)
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },

  // 테스트 파일 패턴
  testMatch: ['**/*.spec.ts', '**/*.test.ts'],

  // 커버리지 설정
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],

  // 커버리지 임계값
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  // 출력 설정
  verbose: true,

  // 타임아웃 (통합 테스트용)
  testTimeout: 30000,

  // 클린업
  clearMocks: true,
  restoreMocks: true,
};
