# @aido/utils

공유 유틸리티 함수 - API/Mobile 공통 로직

## 개요

이 패키지는 Aido 모노레포 전체에서 공유되는 유틸리티 함수를 제공합니다.
트리 쉐이킹을 지원하여 사용하는 함수만 번들에 포함됩니다.

## 설치

모노레포 내 패키지에서 workspace 의존성으로 사용:

```json
{
  "dependencies": {
    "@aido/utils": "workspace:*"
  }
}
```

## 구조

```
src/
├── index.ts           # 메인 export
└── async/             # 비동기 유틸리티
    ├── index.ts
    └── retry.ts       # debounce, throttle
```

## API 레퍼런스

### 비동기 유틸리티

#### `debounce<T>(fn, ms)`

마지막 호출만 실행하는 디바운스 함수를 생성합니다.

| 파라미터   | 타입                | 설명               |
| ---------- | ------------------- | ------------------ |
| `fn`       | `(...args) => void` | 디바운스할 함수    |
| `ms`       | `number`            | 대기 시간 (밀리초) |
| **반환값** | `(...args) => void` | 디바운스된 함수    |

**사용 시나리오:**

- 검색 입력 자동완성
- 윈도우 리사이즈 핸들러
- 폼 자동 저장

```typescript
import { debounce } from "@aido/utils";

// 검색 입력 디바운스 (300ms)
const debouncedSearch = debounce((query: string) => {
  fetch(`/api/search?q=${query}`);
}, 300);

// 연속 입력 시 마지막 값으로만 API 호출
input.addEventListener("input", (e) => {
  debouncedSearch(e.target.value);
});
```

---

#### `throttle<T>(fn, ms)`

일정 간격으로 최대 한 번만 실행하는 쓰로틀 함수를 생성합니다.

| 파라미터   | 타입                | 설명                    |
| ---------- | ------------------- | ----------------------- |
| `fn`       | `(...args) => void` | 쓰로틀할 함수           |
| `ms`       | `number`            | 최소 실행 간격 (밀리초) |
| **반환값** | `(...args) => void` | 쓰로틀된 함수           |

**사용 시나리오:**

- 스크롤 이벤트 처리
- 마우스 이동 추적
- 실시간 위치 업데이트

```typescript
import { throttle } from "@aido/utils";

// 스크롤 이벤트 쓰로틀 (100ms 간격)
const throttledScroll = throttle(() => {
  const scrollY = window.scrollY;
  updateHeaderVisibility(scrollY);
}, 100);

window.addEventListener("scroll", throttledScroll);
```

## 사용 예시

### React Native (Expo)

```typescript
import { debounce } from "@aido/utils";
import { useCallback } from "react";

function SearchScreen() {
  const handleSearch = useCallback(
    debounce((text: string) => {
      // API 호출
    }, 300),
    []
  );

  return <TextInput onChangeText={handleSearch} placeholder="검색어 입력..." />;
}
```

### NestJS

```typescript
import { throttle } from "@aido/utils";

// 로깅 쓰로틀 (중복 로그 방지)
const throttledLog = throttle((message: string) => {
  this.logger.log(message);
}, 1000);
```

## Debounce vs Throttle

| 특성         | Debounce                      | Throttle                      |
| ------------ | ----------------------------- | ----------------------------- |
| 실행 시점    | 마지막 호출 후 대기 시간 경과 | 첫 호출 즉시 (이후 간격 유지) |
| 연속 호출 시 | 계속 지연됨                   | 간격마다 1회 실행             |
| 적합한 용도  | 입력 완료 감지                | 지속적 이벤트 제어            |

```
Debounce (300ms):
호출: ─●──●──●──●──────────────●──────→
실행: ────────────────●───────────────●→
                     ↑ 마지막 호출 후 300ms

Throttle (300ms):
호출: ─●──●──●──●──●──●──●──●──●──●──→
실행: ─●────────●────────●────────●──→
       ↑        ↑        ↑        ↑
      300ms   300ms    300ms    300ms
```

## 테스트

```bash
# 패키지 디렉토리에서
pnpm test

# 루트에서 특정 패키지 테스트
pnpm --filter @aido/utils test
```

## 새 유틸리티 추가 가이드

1. **파일 생성** - 카테고리별 폴더에 파일 추가 (`src/{category}/{name}.ts`)
2. **테스트 작성** - 동일 위치에 `{name}.spec.ts` 추가
3. **Export** - 카테고리 `index.ts`에서 re-export
4. **문서화** - JSDoc 주석과 README 업데이트

````typescript
// src/string/capitalize.ts
/**
 * 문자열 첫 글자를 대문자로 변환
 *
 * @param str - 변환할 문자열
 * @returns 첫 글자가 대문자인 문자열
 *
 * @example
 * ```typescript
 * capitalize('hello'); // 'Hello'
 * ```
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
````
