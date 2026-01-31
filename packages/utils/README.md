# @aido/utils

공유 유틸리티 함수 패키지.

## 설치

```json
{
  "dependencies": {
    "@aido/utils": "workspace:*"
  }
}
```

## 함수

### debounce

연속 호출 중 마지막만 실행.

```typescript
import { debounce } from '@aido/utils';

const debouncedSearch = debounce((query: string) => {
  fetchResults(query);
}, 300);
```

### throttle

일정 간격으로만 실행.

```typescript
import { throttle } from '@aido/utils';

const throttledScroll = throttle(() => {
  console.log(window.scrollY);
}, 100);
```

## 구조

```
src/
├── async/        # debounce, throttle
└── index.ts
```

## 스크립트

| 명령어 | 설명 |
|--------|------|
| `pnpm build` | 빌드 |
| `pnpm test` | 테스트 |
| `pnpm typecheck` | 타입 검사 |
