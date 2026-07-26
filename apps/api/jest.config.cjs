/**
 * @aido/api Jest 설정
 *
 * @aido/jest-config 프리셋을 확장하여 NestJS + SWC 환경에 최적화
 */

const preset = require('@aido/jest-config/jest.preset.cjs');

/** @type {import('jest').Config} */
module.exports = {
  ...preset,

  // SWC로 변환 (ts-jest 대신, 더 빠름)
  transform: {
    '^.+\\.[jt]s$': [
      '@swc/jest',
      {
        jsc: {
          parser: {
            syntax: 'typescript',
            decorators: true,
          },
          transform: {
            legacyDecorator: true,
            decoratorMetadata: true,
          },
          target: 'es2022',
        },
        module: {
          type: 'commonjs',
        },
      },
    ],
  },
  // Apple JWKS 검증 테스트는 ESM-only jose를 실제로 실행한다.
  // pnpm의 실제 경로와 패키지 내부 node_modules 경로 모두 SWC 변환에서 제외하지 않는다.
  transformIgnorePatterns: [
    'node_modules/.pnpm/(?!(jose)@)',
    'node_modules/(?!.pnpm|jose)',
  ],

  // 루트 디렉토리 - unit test + 테스트 인프라 안전장치 spec
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/test/setup'],

  // 테스트 패턴 - unit test만 (e2e, integration은 별도 설정)
  testMatch: undefined,
  testRegex: '.*\\.spec\\.ts$',
  testPathIgnorePatterns: [
    '/node_modules/',
    '\\.e2e-spec\\.ts$',
    '\\.integration-spec\\.ts$',
  ],

  // 커버리지 설정
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/**/*.spec.ts',
    '!src/**/*.e2e-spec.ts',
    '!src/**/*.integration-spec.ts',
  ],
  coverageDirectory: './coverage',

  // 타임아웃 (Testcontainers용)
  testTimeout: 60000,

  // 워커 안정화: @swc/core 네이티브 트랜스폼이 고병렬 워커에서 간헐적 SIGSEGV를
  // 내는 것을 억제한다(Node 24). 워커를 힙 상한에서 재시작해 네이티브 상태 누적을
  // 끊고, 동시 트랜스폼 수를 제한해 크래시 표면을 줄인다. 유닛 스위트 특성상
  // 벽시계 영향은 미미하다.
  workerIdleMemoryLimit: '512MB',
  maxWorkers: '50%',

  // Jest 전역 설정 파일
  setupFilesAfterEnv: ['<rootDir>/test/setup/jest.setup.ts'],

  // 모듈 별칭
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@test/(.*)$': '<rootDir>/test/$1',
    '^@aido/validators$': '<rootDir>/../../packages/validators/src',
    '^@aido/utils$': '<rootDir>/../../packages/utils/src',
    '^(\\.{1,2}/.*)\\.js$': '$1',
    // ESM-only 패키지 스텁 (jest 29 CJS 런타임은 require(esm) 불가)
    '^expo-server-sdk$': '<rootDir>/test/mocks/expo-server-sdk.mock.ts',
    '^ai$': '<rootDir>/test/mocks/ai.mock.ts',
    '^@ai-sdk/google$': '<rootDir>/test/mocks/ai-sdk-google.mock.ts',
  },
};
