# @aido/vitest-config

Aido 모노레포 공유 Vitest 설정

## 사용 대상

- `packages/*` (utils, validators 등)
- 빠른 단위 테스트가 필요한 라이브러리

> **Note:** `apps/api`는 NestJS 통합을 위해 Jest를 사용합니다.

## 주요 설정

| 옵션         | 값                    | 설명                           |
| ------------ | --------------------- | ------------------------------ |
| globals      | true                  | describe, it, expect 전역 사용 |
| environment  | node                  | Node.js 테스트 환경            |
| include      | `**/*.{test,spec}.ts` | 테스트 파일 패턴               |
| clearMocks   | true                  | 각 테스트 후 mock 초기화       |
| restoreMocks | true                  | 각 테스트 후 mock 복원         |

### Coverage 설정

| 옵션             | 값               |
| ---------------- | ---------------- |
| provider         | v8 (2025년 표준) |
| reporter         | text, lcov, html |
| reportsDirectory | ./coverage       |

---

## Jest와 비교

| 항목   | Vitest         | Jest            |
| ------ | -------------- | --------------- |
| 속도   | 빠름 (esbuild) | 보통 (ts-jest)  |
| 설정   | 간단           | NestJS에 최적화 |
| Watch  | 기본 내장      | --watch 필요    |
| ESM    | 네이티브 지원  | 설정 필요       |
| 사용처 | packages/\*    | apps/api        |

---

## 사용 방법

### 1. 기본 사용

```typescript
// packages/utils/vitest.config.ts
import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "@aido/vitest-config";

export default mergeConfig(
  baseConfig,
  defineConfig({
    // 추가 설정
  })
);
```

### 2. 루트 디렉토리 변경

```typescript
import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "@aido/vitest-config";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      root: "./src",
    },
  })
);
```

### 3. 커버리지 임계값 추가

```typescript
import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "@aido/vitest-config";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      coverage: {
        thresholds: {
          lines: 80,
          functions: 80,
          branches: 80,
          statements: 80,
        },
      },
    },
  })
);
```

### 4. 별칭(alias) 설정

```typescript
import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "@aido/vitest-config";
import path from "node:path";

export default mergeConfig(
  baseConfig,
  defineConfig({
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  })
);
```

---

## 테스트 작성

### 기본 테스트

```typescript
// src/add.spec.ts
import { describe, it, expect } from "vitest";
import { add } from "./add";

describe("add", () => {
  it("두 숫자를 더한다", () => {
    expect(add(1, 2)).toBe(3);
  });
});
```

### Mock 사용

```typescript
import { describe, it, expect, vi } from "vitest";

describe("fetchData", () => {
  it("API 호출을 테스트한다", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ data: "test" });

    const result = await fetchData(mockFetch);

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(result).toEqual({ data: "test" });
  });
});
```

### Snapshot 테스트

```typescript
import { describe, it, expect } from "vitest";

describe("schema", () => {
  it("올바른 형태를 반환한다", () => {
    const result = createSchema();
    expect(result).toMatchSnapshot();
  });
});
```

---

## 명령어

```bash
# 테스트 실행
pnpm test

# Watch 모드
pnpm test --watch

# 커버리지
pnpm test --coverage

# 특정 파일
pnpm test src/add.spec.ts

# 패턴 매칭
pnpm test -t "add"
```

---

## 프리셋 전체 설정

```typescript
// vitest.preset.ts
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.{test,spec}.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      reportsDirectory: "./coverage",
      exclude: ["**/*.d.ts", "**/index.ts", "**/*.spec.ts", "**/*.test.ts"],
    },
    clearMocks: true,
    restoreMocks: true,
  },
});
```

---

## 라이선스

MIT
