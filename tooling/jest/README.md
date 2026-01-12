# @aido/jest-config

Aido 모노레포 공유 Jest 설정

## 설정 파일

### jest.preset.cjs

모든 패키지의 기본 Jest 프리셋

## 주요 설정

| 옵션            | 값                             | 설명                     |
| --------------- | ------------------------------ | ------------------------ |
| preset          | ts-jest                        | TypeScript 지원          |
| testEnvironment | node                           | Node.js 환경             |
| testMatch       | \*\*/_.spec.ts, \*\*/_.test.ts | 테스트 파일 패턴         |
| testTimeout     | 30000                          | 기본 타임아웃 30초       |
| verbose         | true                           | 상세 출력                |
| clearMocks      | true                           | 각 테스트 후 mock 초기화 |
| restoreMocks    | true                           | 각 테스트 후 mock 복원   |

### Coverage 설정

| 옵션                | 값                   |
| ------------------- | -------------------- |
| collectCoverageFrom | src/\*\*/\*.{ts,tsx} |
| coverageDirectory   | coverage             |
| coverageReporters   | text, lcov, html     |

## 사용 방법

각 패키지의 `jest.config.cjs`에서 프리셋 확장:

```javascript
const preset = require("@aido/jest-config/jest.preset.cjs");

module.exports = {
  ...preset,
  // 패키지별 추가 설정
  rootDir: ".",
  roots: ["<rootDir>/src"],
};
```

### NestJS 프로젝트 예시

```javascript
const preset = require("@aido/jest-config/jest.preset.cjs");

module.exports = {
  ...preset,
  transform: {
    "^.+\\.ts$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", decorators: true },
          transform: { legacyDecorator: true, decoratorMetadata: true },
        },
      },
    ],
  },
  rootDir: ".",
  roots: ["<rootDir>/src", "<rootDir>/test"],
  testRegex: ".*\\.(spec|e2e-spec)\\.ts$",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};
```

## 명령어

```bash
# 테스트 실행
pnpm test

# E2E 테스트
pnpm test:e2e

# 커버리지
pnpm test:cov

# Watch 모드
pnpm test -- --watch
```

## 라이선스

MIT
