/**
 * @aido/api Jest 설정
 *
 * @aido/jest-config 프리셋을 확장하여 NestJS + SWC 환경에 최적화
 */

const preset = require("@aido/jest-config/jest.preset.cjs");

/** @type {import('jest').Config} */
module.exports = {
  ...preset,

  // SWC로 변환 (ts-jest 대신, 더 빠름)
  transform: {
    "^.+\\.ts$": [
      "@swc/jest",
      {
        jsc: {
          parser: {
            syntax: "typescript",
            decorators: true,
          },
          transform: {
            legacyDecorator: true,
            decoratorMetadata: true,
          },
          target: "es2022",
        },
        module: {
          type: "commonjs",
        },
      },
    ],
  },

  // 루트 디렉토리
  rootDir: ".",
  roots: ["<rootDir>/src", "<rootDir>/test"],

  // 테스트 패턴 (testMatch 대신 testRegex 사용)
  testMatch: undefined,
  testRegex: ".*\\.(spec|e2e-spec)\\.ts$",

  // 커버리지 설정
  collectCoverageFrom: [
    "src/**/*.(t|j)s",
    "!src/**/*.spec.ts",
    "!src/**/*.e2e-spec.ts",
    "!src/**/*.integration-spec.ts",
  ],
  coverageDirectory: "./coverage",

  // 타임아웃 (Testcontainers용)
  testTimeout: 60000,

  // 모듈 별칭
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@aido/validators$": "<rootDir>/../../packages/validators/src",
    "^@aido/utils$": "<rootDir>/../../packages/utils/src",
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
};
