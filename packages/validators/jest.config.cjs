/**
 * @aido/validators Jest 설정
 *
 * @aido/jest-config 프리셋을 확장하여 순수 함수 테스트에 최적화
 */

const preset = require('@aido/jest-config/jest.preset.cjs');

/** @type {import('jest').Config} */
module.exports = {
  ...preset,

  rootDir: '.',
  roots: ['<rootDir>/src'],

  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
};
