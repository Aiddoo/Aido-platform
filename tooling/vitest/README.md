# @aido/vitest-config

> **Version**: 1.1.0 · **Last Updated**: 2026-10-01 · **Owner**: Aido Platform Team

공유 패키지의 Node.js 단위 테스트에 사용하는 Vitest 5 ESM 프리셋입니다. API도 Vitest를 사용하며, Nest 데코레이터 메타데이터와 PostgreSQL 수명주기는 `apps/api/vitest.config.ts`에서 설정합니다.

| 설정         | 값                    | 동작                                 |
| ------------ | --------------------- | ------------------------------------ |
| globals      | `true`                | `describe`, `it`, `expect` 전역 제공 |
| environment  | `node`                | Node.js 환경                         |
| include      | `**/*.{test,spec}.ts` | 단위 테스트 탐색                     |
| clearMocks   | `true`                | 각 테스트 전에 호출 기록 초기화      |
| restoreMocks | `true`                | 각 테스트 전에 spy 복원              |
| coverage     | `v8`                  | text, lcov, html, json-summary 출력  |

```typescript
import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from '@aido/vitest-config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      coverage: {
        thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
      },
    },
  }),
);
```

`vi.spyOn`은 `beforeEach` 또는 테스트 내부에서 등록합니다. `beforeAll`에서 만든 spy는 `restoreMocks`가 다음 테스트 전에 복원하므로 이후 테스트에 적용되지 않습니다. ESM 모듈 mock은 `vi.mock`과 `vi.hoisted`를 사용하며, 생성자 mock은 일반 함수로 작성합니다.

```bash
pnpm --filter @aido/validators test
pnpm --filter @aido/validators exec vitest --coverage
pnpm --filter @aido/api exec vitest run --project unit
pnpm --filter @aido/api exec vitest run --project integration
pnpm --filter @aido/api exec vitest run --project e2e
```

API의 통합 및 E2E 프로젝트는 각각 독립된 관리형 PostgreSQL을 준비하고 종료합니다. 자세한 규칙은 [API 테스트 가이드](../../apps/api/.claude/testing-guide.md)를 참고합니다.
