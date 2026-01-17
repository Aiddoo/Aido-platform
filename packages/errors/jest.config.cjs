const preset = require('@aido/jest-config/jest.preset.cjs');

/** @type {import('jest').Config} */
module.exports = {
  ...preset,
  rootDir: '.',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/index.ts',
  ],
};
