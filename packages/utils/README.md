# @aido/utils

> 공유 유틸리티 함수 패키지

![Version](https://img.shields.io/badge/version-0.0.0-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## 개요

프론트엔드와 백엔드에서 공유하는 유틸리티 함수 패키지입니다. 타입 안전하고 테스트된 헬퍼 함수들을 제공합니다.

## 주요 기능

- **비동기 유틸리티**: debounce, throttle
- **완전한 TypeScript 지원**: 제네릭 타입 추론
- **Vitest 테스트**: 단위 테스트 포함

## 설치

이 패키지는 모노레포 내부 패키지로, 워크스페이스에서 자동으로 사용 가능합니다.

```json
{
  "dependencies": {
    "@aido/utils": "workspace:*"
  }
}
```

## 사용법

### debounce

연속적인 호출 중 마지막 호출만 실행합니다.

```typescript
import { debounce } from '@aido/utils';

// 검색 입력 디바운스
const debouncedSearch = debounce((query: string) => {
  console.log('Searching:', query);
  fetchResults(query);
}, 300);

// React Native 예시
<TextInput onChangeText={debouncedSearch} />

// 연속 호출 시
debouncedSearch('h');     // 무시됨
debouncedSearch('he');    // 무시됨
debouncedSearch('hel');   // 300ms 후 'hel'로 실행
```

### throttle

일정 간격으로만 함수를 실행합니다.

```typescript
import { throttle } from '@aido/utils';

// 스크롤 이벤트 쓰로틀
const throttledScroll = throttle(() => {
  console.log('Scroll position:', window.scrollY);
}, 100);

window.addEventListener('scroll', throttledScroll);

// 100ms 내 여러 번 호출해도 첫 번째만 실행
```

## 프로젝트 구조

```
src/
├── async/                  # 비동기 유틸리티
│   ├── retry.ts           # debounce, throttle
│   ├── retry.spec.ts      # 테스트
│   └── index.ts
└── index.ts               # 메인 진입점
```

## 제공 함수

### Async

| 함수 | 설명 | 용도 |
|------|------|------|
| `debounce(fn, ms)` | 연속 호출 중 마지막만 실행 | 검색 입력, 폼 검증 |
| `throttle(fn, ms)` | 일정 간격으로만 실행 | 스크롤, 리사이즈 이벤트 |

## API 상세

### debounce

```typescript
function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `fn` | `Function` | 디바운스할 함수 |
| `ms` | `number` | 대기 시간 (밀리초) |

**반환값**: 디바운스된 새 함수

### throttle

```typescript
function throttle<T extends (...args: Parameters<T>) => void>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `fn` | `Function` | 쓰로틀할 함수 |
| `ms` | `number` | 최소 실행 간격 (밀리초) |

**반환값**: 쓰로틀된 새 함수

## 스크립트

```bash
pnpm build        # TypeScript 빌드
pnpm dev          # Watch 모드 빌드
pnpm typecheck    # 타입 체크
pnpm check        # Biome 린트
pnpm test         # Vitest 테스트
pnpm test:watch   # 테스트 Watch 모드
```

## 테스트

Vitest 기반 단위 테스트:

```bash
pnpm test
```

```typescript
// retry.spec.ts
import { describe, it, expect, vi } from 'vitest';
import { debounce, throttle } from './retry';

describe('debounce', () => {
  it('should call function after delay', async () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    
    debounced();
    expect(fn).not.toBeCalled();
    
    await new Promise(r => setTimeout(r, 150));
    expect(fn).toBeCalledTimes(1);
  });
});
```

## 변경 이력

### v0.0.0 (2025-01-13)

- 초기 릴리즈
- debounce 함수 구현
- throttle 함수 구현
- Vitest 테스트 설정
- TypeScript 제네릭 타입 지원
