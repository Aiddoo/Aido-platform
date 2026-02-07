# Mobile 앱 테스트 가이드

## 핵심 원칙

> **DI + `jest.fn()` = 레이어 격리 테스트**
>
> 모든 의존성은 생성자 주입을 사용하므로, `jest.fn()` mock 객체로 교체하여 각 레이어를 독립적으로 테스트한다.
> Policy와 Mapper는 순수 함수이므로 mock 없이 직접 테스트한다.

---

## 테스트 경계 다이어그램

```
┌──────────────────────────────────────────────────────────┐
│  UI Component          mock: Service (DI 훅)             │
│    └─ render + screen 검증                               │
├──────────────────────────────────────────────────────────┤
│  Service               mock: Repository                  │
│    └─ Policy 검증 + Result 전파                           │
├──────────────────────────────────────────────────────────┤
│  Repository            mock: HttpClient                  │
│    └─ API 호출 + Zod 검증 + Mapper 변환                   │
├──────────────────────────────────────────────────────────┤
│  Mapper                mock 없음 (순수 함수)              │
│    └─ DTO → Domain 변환                                  │
├──────────────────────────────────────────────────────────┤
│  Policy                mock 없음 (순수 함수)              │
│    └─ 비즈니스 규칙 판단                                   │
└──────────────────────────────────────────────────────────┘
```

---

## 테스트 우선순위

| 우선순위 | 레이어 | 이유 | mock 필요 |
|---------|--------|------|----------|
| 1 | **Policy** | 비즈니스 로직의 핵심, 순수 함수라 작성 쉬움 | 없음 |
| 2 | **Mapper** | 서버 변경 감지의 방파제, 순수 함수 | 없음 |
| 3 | **Service** | Policy 검증 + Repository 위임 검증 | mock Repository |
| 4 | **Repository** | API 응답 파싱, Zod 검증, Result 반환 | mock HttpClient |
| 5 | **UI 컴포넌트** | 렌더링 + 사용자 상호작용 | mock Service (DI 훅) |

---

## 파일 위치 & 네이밍 규칙

테스트 파일은 **대상 파일과 같은 디렉토리**에 배치한다.

| 테스트 대상 | 파일명 패턴 | 예시 |
|------------|-----------|------|
| Policy | `{feature}.model.test.ts` | `todo.model.test.ts` |
| Mapper | `{feature}.mapper.test.ts` | `todo.mapper.test.ts` |
| Service | `{feature}.service.test.ts` | `todo.service.test.ts` |
| Repository | `{feature}.repository.impl.test.ts` | `todo.repository.impl.test.ts` |
| UI 컴포넌트 | `{Component}.test.tsx` | `TodoList.test.tsx` |

> **주의**: `.spec.ts`가 아니라 **`.test.ts` / `.test.tsx`** 를 사용한다 (코드베이스 컨벤션).

---

## 공통 패턴

### Given-When-Then 구조

모든 테스트는 **반드시** `// Given`, `// When`, `// Then` 주석으로 구분한다. `describe`/`it`은 한국어로 작성한다.

```typescript
it('특정 조건에서 기대하는 결과가 나와야 한다', async () => {
  // Given — 테스트 데이터 및 mock 설정
  const item = create{Feature}({ status: 'active' });

  // When — 테스트 대상 실행
  const result = {Feature}Policy.isActive(item);

  // Then — 결과 검증
  expect(result).toBe(true);
});
```

### 성공 + 실패 케이스를 반드시 함께 테스트

> **규칙**: 성공하는 케이스만 테스트하지 않는다. **실패가 예상되는 케이스도 반드시 포함**해야 한다.

모든 `describe` 블록에는 최소 **성공 1개 + 실패 1개** 테스트가 있어야 한다.

| 레이어 | 성공 케이스 | 실패 케이스 |
|--------|-----------|-----------|
| Policy | `isValid('valid')` → `true` | `isValid('')` → `false` |
| Mapper | 정상 DTO → Domain 변환 | nullable 필드가 null인 경우 |
| Repository | ok Response → ok Result | 4xx → err Result, 잘못된 응답 → ParseError |
| Service | Repository 성공 → ok 전파 | Policy 실패 → err + Repository 미호출 |
| UI 컴포넌트 | 정상 데이터 렌더링 | 에러 상태 UI 렌더링 |

### 테스트 데이터 팩토리

팩토리 함수를 사용하면 **테스트마다 달라지는 값만 명시**할 수 있어 의도가 명확해진다.
팩토리는 **테스트 파일 상단**이나 **같은 디렉토리의 별도 파일**에 정의한다.

```typescript
/** DTO (서버 응답) 팩토리 */
const create{Feature}Dto = (overrides?: Partial<{Feature}Dto>): {Feature}Dto => ({
  id: 1,
  name: '기본 이름',
  status: 'active',
  createdAt: '2024-06-01T09:00:00Z',
  ...overrides,
});

/** Domain 모델 팩토리 */
const create{Feature} = (overrides?: Partial<{Feature}>): {Feature} => ({
  id: 1,
  name: '기본 이름',
  status: 'active',
  createdAt: new Date('2024-06-01T09:00:00Z'),
  ...overrides,
});
```

**사용법**:

```typescript
const dto = create{Feature}Dto();                              // 기본값
const expiredDto = create{Feature}Dto({ status: 'expired' });  // 오버라이드
```

### Mock 생성 패턴

#### HttpClient mock

```typescript
import type { HttpClient } from '@src/core/ports/http';

const createMockHttpClient = (): jest.Mocked<HttpClient> => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
});
```

#### Repository mock

인터페이스의 **모든 메서드**를 `jest.fn()`으로 구현한다.

```typescript
import type { {Feature}Repository } from './{feature}.repository';

const createMock{Feature}Repository = (): jest.Mocked<{Feature}Repository> => ({
  getById: jest.fn(),
  getList: jest.fn(),
  create: jest.fn(),
  // ...인터페이스에 정의된 나머지 메서드
});
```

#### 기타 Port mock (Storage 등)

```typescript
import type { Storage } from '@src/core/ports/storage';

const createMockStorage = (): jest.Mocked<Storage> => ({
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
});
```

### Result 검증 패턴

```typescript
// 성공 검증
expect(result.ok).toBe(true);
if (result.ok) {
  expect(result.value).toEqual(expected);
}

// 실패 검증
expect(result.ok).toBe(false);
if (!result.ok) {
  expect(result.error.code).toBe('ERROR_CODE');
}
```

### mock 설정 패턴

```typescript
// 성공 응답
repository.getList.mockResolvedValue(ok(data));

// 에러 응답 (서버 4xx)
repository.getList.mockResolvedValue(err(new ApiError('CODE', '메시지', 404)));

// throw (InfraError — 5xx/네트워크)
httpClient.get.mockRejectedValue(new ServerError(500));
```

---

## 레이어별 테스트 패턴

### 1. Policy 테스트 (순수 함수, mock 없음)

Policy는 비즈니스 로직의 핵심이다. 5가지 카테고리별로 테스트한다:
- **상태 판단** (`is{상태}`) — 경계값 + 양쪽 케이스
- **가능 여부** (`can{동작}`) — 허용/거부 조건
- **표시값** (`get{값}`) — 파생 값 계산 결과
- **유효성 검증** (`isValid{대상}`) — 유효/무효 입력
- **비즈니스 상수** (`UPPER_SNAKE`) — 값 존재 확인

```typescript
// features/{feature}/models/{feature}.model.test.ts
import { {Feature}Policy } from './{feature}.model';

const create{Feature} = (overrides?: Partial<{Feature}>): {Feature} => ({
  id: 1,
  name: '기본 이름',
  status: 'active',
  expiresAt: new Date('2025-12-31'),
  ...overrides,
});

describe('{Feature}Policy', () => {
  // 상태 판단 — 경계 양쪽 케이스 (true/false)
  describe('isExpired', () => {
    it('만료일이 현재보다 이전이면 true를 반환해야 한다', () => {
      // Given
      const item = create{Feature}({ expiresAt: new Date('2020-01-01') });

      // When
      const result = {Feature}Policy.isExpired(item);

      // Then
      expect(result).toBe(true);
    });

    it('만료일이 현재보다 이후이면 false를 반환해야 한다', () => {
      // Given
      const item = create{Feature}({ expiresAt: new Date('2099-12-31') });

      // When
      const result = {Feature}Policy.isExpired(item);

      // Then
      expect(result).toBe(false);
    });
  });

  // 가능 여부 — 허용/거부 조건
  describe('canEdit', () => {
    it('활성 상태이면 수정 가능해야 한다', () => {
      // Given
      const item = create{Feature}({ status: 'active' });

      // When
      const result = {Feature}Policy.canEdit(item);

      // Then
      expect(result).toBe(true);
    });

    it('만료 상태이면 수정 불가능해야 한다', () => {
      // Given
      const item = create{Feature}({ status: 'expired' });

      // When
      const result = {Feature}Policy.canEdit(item);

      // Then
      expect(result).toBe(false);
    });
  });

  // 표시값 결정
  describe('getDisplayLabel', () => {
    it('이름이 있으면 이름을 반환해야 한다', () => {
      // Given
      const item = create{Feature}({ name: '테스트 이름' });

      // When
      const result = {Feature}Policy.getDisplayLabel(item);

      // Then
      expect(result).toBe('테스트 이름');
    });

    it('이름이 없으면 기본값을 반환해야 한다', () => {
      // Given
      const item = create{Feature}({ name: '' });

      // When
      const result = {Feature}Policy.getDisplayLabel(item);

      // Then
      expect(result).toBe('이름 없음');
    });
  });

  // 유효성 검증 — 유효/무효 입력 쌍
  describe('isValidInput', () => {
    it('유효한 입력이면 true를 반환해야 한다', () => {
      // Given
      const input = 'valid-value';

      // When
      const result = {Feature}Policy.isValidInput(input);

      // Then
      expect(result).toBe(true);
    });

    it('빈 문자열이면 false를 반환해야 한다', () => {
      // Given
      const input = '';

      // When
      const result = {Feature}Policy.isValidInput(input);

      // Then
      expect(result).toBe(false);
    });
  });

  // 비즈니스 상수
  describe('상수', () => {
    it('MAX_COUNT가 정의되어 있어야 한다', () => {
      // Then
      expect({Feature}Policy.MAX_COUNT).toBeDefined();
      expect(typeof {Feature}Policy.MAX_COUNT).toBe('number');
    });
  });
});
```

### 2. Mapper 테스트 (DTO → Domain, mock 없음)

Mapper는 서버 변경의 방파제다. **타입 변환** (string → Date 등)과 **nullable 처리**를 집중 검증한다.

```typescript
// features/{feature}/repositories/{feature}.mapper.test.ts
import { to{Feature}, to{Feature}s } from './{feature}.mapper';

const create{Feature}Dto = (overrides?: Partial<{Feature}Dto>): {Feature}Dto => ({
  id: 1,
  name: '기본 이름',
  createdAt: '2024-06-01T09:00:00Z',
  optionalField: null,
  ...overrides,
});

describe('{Feature} Mapper', () => {
  describe('to{Feature}', () => {
    it('날짜 문자열을 Date 객체로 변환해야 한다', () => {
      // Given
      const dto = create{Feature}Dto({ createdAt: '2024-06-01T09:00:00Z' });

      // When
      const result = to{Feature}(dto);

      // Then
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.createdAt.toISOString()).toBe('2024-06-01T09:00:00.000Z');
    });

    it('nullable 필드가 null이면 null을 유지해야 한다', () => {
      // Given
      const dto = create{Feature}Dto({ optionalField: null });

      // When
      const result = to{Feature}(dto);

      // Then
      expect(result.optionalField).toBeNull();
    });

    it('모든 필드를 올바르게 매핑해야 한다', () => {
      // Given
      const dto = create{Feature}Dto();

      // When
      const result = to{Feature}(dto);

      // Then
      expect(result).toEqual({
        id: 1,
        name: '기본 이름',
        createdAt: new Date('2024-06-01T09:00:00Z'),
        optionalField: null,
      });
    });
  });

  describe('to{Feature}s', () => {
    it('DTO 배열을 Domain 모델 배열로 변환해야 한다', () => {
      // Given
      const dtos = [create{Feature}Dto(), create{Feature}Dto({ id: 2 })];

      // When
      const result = to{Feature}s(dtos);

      // Then
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
    });

    it('빈 배열이면 빈 배열을 반환해야 한다', () => {
      // Given
      const dtos: {Feature}Dto[] = [];

      // When
      const result = to{Feature}s(dtos);

      // Then
      expect(result).toHaveLength(0);
    });
  });
});
```

### 3. Repository 테스트 (mock HttpClient)

Repository는 **API 호출 → Zod 검증 → Mapper 변환 → Result 반환** 흐름을 검증한다.

```typescript
// features/{feature}/repositories/{feature}.repository.impl.test.ts
import type { HttpClient } from '@src/core/ports/http';
import { ApiError } from '@src/shared/errors/api-error';
import { ServerError, ParseError } from '@src/shared/errors/infra-error';
import { ok, err } from '@src/shared/errors/result';

import { {Feature}RepositoryImpl } from './{feature}.repository.impl';

const createMockHttpClient = (): jest.Mocked<HttpClient> => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
});

// 서버 응답 형태의 DTO 팩토리
const create{Feature}Response = () => ({
  id: 1,
  name: '기본 이름',
  createdAt: '2024-06-01T09:00:00Z',
});

describe('{Feature}RepositoryImpl', () => {
  let httpClient: jest.Mocked<HttpClient>;
  let repository: {Feature}RepositoryImpl;

  beforeEach(() => {
    httpClient = createMockHttpClient();
    repository = new {Feature}RepositoryImpl(httpClient);
  });

  describe('getById', () => {
    it('API 성공 응답을 Zod로 검증하고 ok Result를 반환해야 한다', async () => {
      // Given
      httpClient.get.mockResolvedValue(ok(create{Feature}Response()));

      // When
      const result = await repository.getById(1);

      // Then
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBe(1);
      }
      expect(httpClient.get).toHaveBeenCalledWith(
        expect.stringContaining('v1/{feature}s'),
        expect.any(Object),
      );
    });

    it('4xx API 에러 시 err Result를 그대로 전파해야 한다', async () => {
      // Given
      httpClient.get.mockResolvedValue(
        err(new ApiError('{FEATURE}_0801', '리소스를 찾을 수 없어요', 404)),
      );

      // When
      const result = await repository.getById(1);

      // Then
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.status).toBe(404);
      }
    });

    it('Zod 검증 실패 시 ParseError를 throw해야 한다', async () => {
      // Given — 스키마에 맞지 않는 응답
      httpClient.get.mockResolvedValue(ok({ invalid: 'data' }));

      // When & Then
      await expect(repository.getById(1)).rejects.toThrow(ParseError);
    });

    it('HttpClient가 throw하면 그대로 전파해야 한다', async () => {
      // Given — 5xx 서버 에러
      httpClient.get.mockRejectedValue(new ServerError(500));

      // When & Then
      await expect(repository.getById(1)).rejects.toThrow(ServerError);
    });
  });
});
```

### 4. Service 테스트

Service 테스트는 두 가지 패턴이 있다.

#### 패턴 A: Passthrough (단순 위임)

대부분의 Service 메서드는 Repository를 그대로 호출한다. **호출 여부**와 **Result 전파**를 검증한다.

```typescript
// features/{feature}/services/{feature}.service.test.ts
import type { {Feature}Repository } from '../repositories/{feature}.repository';
import { ApiError } from '@src/shared/errors/api-error';
import { ok, err } from '@src/shared/errors/result';

import { {Feature}Service } from './{feature}.service';

const createMock{Feature}Repository = (): jest.Mocked<{Feature}Repository> => ({
  getById: jest.fn(),
  getList: jest.fn(),
  create: jest.fn(),
  // ...인터페이스에 정의된 나머지 메서드
});

const create{Feature} = (overrides?: Partial<{Feature}>): {Feature} => ({
  id: 1,
  name: '기본 이름',
  ...overrides,
});

describe('{Feature}Service', () => {
  let repository: jest.Mocked<{Feature}Repository>;
  let service: {Feature}Service;

  beforeEach(() => {
    repository = createMock{Feature}Repository();
    service = new {Feature}Service(repository);
  });

  describe('getList', () => {
    it('Repository 성공 시 ok Result를 반환해야 한다', async () => {
      // Given
      repository.getList.mockResolvedValue(ok([create{Feature}()]));

      // When
      const result = await service.getList();

      // Then
      expect(result.ok).toBe(true);
      expect(repository.getList).toHaveBeenCalled();
    });

    it('Repository가 에러를 반환하면 그대로 전파해야 한다', async () => {
      // Given
      repository.getList.mockResolvedValue(
        err(new ApiError('{FEATURE}_0801', '리소스를 찾을 수 없어요', 404)),
      );

      // When
      const result = await service.getList();

      // Then
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('{FEATURE}_0801');
      }
    });
  });
});
```

#### 패턴 B: Policy 검증 (클라이언트에서 먼저 거르기)

Service가 **Policy로 검증** 후 실패하면 `{Feature}Error`를 반환하고, **Repository를 호출하지 않는다**.

```typescript
  describe('create', () => {
    it('유효한 입력이면 Repository를 호출해야 한다', async () => {
      // Given
      repository.create.mockResolvedValue(ok(create{Feature}()));

      // When
      const result = await service.create({ value: 'valid-input' });

      // Then
      expect(repository.create).toHaveBeenCalledWith({ value: 'valid-input' });
      expect(result.ok).toBe(true);
    });

    it('무효한 입력이면 {Feature}Error를 반환하고 Repository를 호출하지 않아야 한다', async () => {
      // Given — 무효한 입력 (빈 문자열)

      // When
      const result = await service.create({ value: '' });

      // Then
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('{FEATURE}_INVALID_INPUT');
      }
      expect(repository.create).not.toHaveBeenCalled();
    });
  });
```

> **핵심 검증 포인트**: Policy 실패 시 `repository.method`가 `not.toHaveBeenCalled()`인지 확인한다.

### 5. UI 컴포넌트 테스트

컴포넌트 테스트에는 TanStack Query의 `QueryClient`가 필요하다.

#### renderWithClient 유틸

```typescript
// shared/testing/utils/render-with-client.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';

export function renderWithClient(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>,
  );
}
```

#### 컴포넌트 테스트 예시

```tsx
// features/{feature}/presentations/components/{Feature}Card.test.tsx
import { render, screen } from '@testing-library/react-native';
import { {Feature}Card } from './{Feature}Card';

const create{Feature} = (overrides?: Partial<{Feature}>): {Feature} => ({
  id: 1,
  name: '기본 이름',
  status: 'active',
  ...overrides,
});

describe('{Feature}Card', () => {
  it('이름을 렌더링해야 한다', () => {
    // Given
    const item = create{Feature}({ name: '테스트' });

    // When
    render(<{Feature}Card item={item} />);

    // Then
    expect(screen.getByText('테스트')).toBeTruthy();
  });

  it('만료 상태이면 만료 배지를 표시해야 한다', () => {
    // Given
    const item = create{Feature}({ status: 'expired' });

    // When
    render(<{Feature}Card item={item} />);

    // Then
    expect(screen.getByText('만료')).toBeTruthy();
  });

  it('활성 상태이면 만료 배지를 표시하지 않아야 한다', () => {
    // Given
    const item = create{Feature}({ status: 'active' });

    // When
    render(<{Feature}Card item={item} />);

    // Then
    expect(screen.queryByText('만료')).toBeNull();
  });
});
```

> **QueryErrorBoundary 테스트**: `ThrowError` 컴포넌트 + `renderWithClient`로 InfraError → fallback UI 렌더링을 검증할 수 있다. 필요 시 `shared/ui/QueryErrorBoundary/` 하위에 작성한다.

---

## 테스트 실행

```bash
# 전체 테스트
pnpm --filter @aido/mobile test

# 특정 파일 테스트
pnpm --filter @aido/mobile test -- {feature}.service.test.ts

# 특정 패턴 테스트
pnpm --filter @aido/mobile test -- --testPathPattern=mapper

# 커버리지 확인
pnpm --filter @aido/mobile test -- --coverage
```

### jest.config.js 주요 설정

| 설정 | 값 |
|------|-----|
| preset | `jest-expo` |
| testMatch | `**/*.test.[jt]s?(x)`, `**/*.spec.[jt]s?(x)` |
| setupFilesAfterSetup | (현재 주석 처리됨) |
| moduleNameMapper | `@aido/api-types` → packages, `@aido/utils` → packages, `expo-secure-store` → mock |

---

## 레이어별 체크리스트

### Policy

- [ ] 5가지 카테고리별 테스트 (상태 판단, 가능 여부, 표시값, 유효성 검증, 상수)
- [ ] 경계값 테스트 (경계 양쪽 케이스)
- [ ] 유효/무효 입력 모두 검증

### Mapper

- [ ] DTO → Domain 변환이 올바른지 검증
- [ ] 날짜 문자열 → Date 변환 확인
- [ ] nullable 필드 처리 확인
- [ ] 배열 변환 (`to{Feature}s`) 확인

### Service

- [ ] Passthrough: Repository 호출 여부 + ok/err Result 전파 검증
- [ ] Policy 검증: err Result 반환 + Repository 미호출 확인
- [ ] 여러 의존성 조합 시 각 의존성 호출 순서 검증

### Repository

- [ ] 성공 응답 → Zod 검증 → ok Result 반환
- [ ] 4xx 에러 → err Result 그대로 전파
- [ ] Zod 검증 실패 → ParseError throw
- [ ] 5xx/네트워크 → InfraError throw 전파

### UI 컴포넌트

- [ ] 렌더링 확인 (주요 텍스트, 요소)
- [ ] 조건부 렌더링 (상태에 따른 UI 변화)
- [ ] 사용자 상호작용 (`fireEvent.press` 등)

### 공통

- [ ] `describe`/`it` 한국어 작성
- [ ] Given-When-Then 구조 준수
- [ ] 팩토리 함수로 테스트 데이터 생성
- [ ] 에러 케이스 포함

---

## 참고 파일

| 파일 | 설명 |
|------|------|
| `src/core/ports/http.ts` | HttpClient 인터페이스 |
| `src/core/ports/storage.ts` | Storage 인터페이스 |
| `src/shared/errors/result.ts` | Result 타입, ok/err/unwrap |
| `src/shared/errors/api-error.ts` | ApiError (서버 4xx) |
| `src/shared/errors/infra-error.ts` | InfraError (5xx, 네트워크, 파싱) |
| `src/features/*/models/*.model.ts` | Domain Model + Policy |
| `src/features/*/repositories/*.repository.ts` | Repository 인터페이스 |
| `src/features/*/services/*.service.ts` | Service 구현 |
| `jest.config.js` | Jest 설정 |
