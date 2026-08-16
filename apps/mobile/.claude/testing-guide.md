# Mobile 앱 테스트 가이드

**Version**: 1.0.0 · **Last Updated**: 2026-04-23 · **Owner**: Aido Mobile Team

> DI + `jest.fn()` 기반 레이어별 격리 테스트.

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
│  Service               mock: HttpClient                  │
│    └─ HTTP 호출 + Zod 검증 + Mapper 변환 + Policy 검증     │
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

| 우선순위 | 레이어          | 이유                                        | mock 필요            |
| -------- | --------------- | ------------------------------------------- | -------------------- |
| 1        | **Policy**      | 비즈니스 로직의 핵심, 순수 함수라 작성 쉬움 | 없음                 |
| 2        | **Mapper**      | 서버 변경 감지의 방파제, 순수 함수          | 없음                 |
| 3        | **Service**     | HTTP + Zod + Mapper + Policy 통합 검증      | mock HttpClient      |
| 4        | **UI 컴포넌트** | 렌더링 + 사용자 상호작용                    | mock Service (DI 훅) |

---

## 파일 위치 & 네이밍 규칙

테스트 파일은 **대상 파일과 같은 디렉토리**에 배치한다.

| 테스트 대상 | 파일명 패턴                                 |
| ----------- | ------------------------------------------- |
| Policy      | `{feature}.model.test.ts`                   |
| Mapper      | `{feature}.mapper.test.ts` (services/ 하위) |
| Service     | `{feature}.service.test.ts`                 |
| UI 컴포넌트 | `{Component}.test.tsx`                      |

> **주의**: `.spec.ts`가 아니라 **`.test.ts` / `.test.tsx`** 를 사용한다 (코드베이스 컨벤션).

---

## 공통 패턴

### Given-When-Then 구조

테스트 본문은 `// Given`, `// When`, `// Then` 주석으로 구분한다. `describe`/`it` 설명은 한국어로 **간결하게** 작성한다 — Given/When/Then을 설명에 넣지 않는다.

```typescript
it('활성 상태이면 true를 반환한다', async () => {
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

| 레이어      | 성공 케이스                            | 실패 케이스                             |
| ----------- | -------------------------------------- | --------------------------------------- |
| Policy      | `isValid('valid')` → `true`            | `isValid('')` → `false`                 |
| Mapper      | 정상 DTO → Domain 변환                 | nullable 필드가 null인 경우             |
| Service     | ok Response → Zod → Mapper → ok Result | 4xx → err Result, Zod 실패 → ParseError |
| UI 컴포넌트 | 정상 데이터 렌더링                     | 에러 상태 UI 렌더링                     |

### 테스트 데이터 팩토리

기본값이 있는 팩토리 함수로 테스트 데이터를 생성한다.
모델 필드가 추가/변경되어도 **팩토리의 기본값만 수정**하면 모든 테스트가 일괄 대응된다.
각 테스트에서는 해당 테스트의 **의도에 관련된 필드만 오버라이드**하므로, 무엇을 검증하는지 명확해진다.

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
httpClient.get.mockResolvedValue(ok(data));

// 에러 응답 (서버 4xx)
httpClient.get.mockResolvedValue(err(new ApiError('CODE', '메시지', 404)));

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
// features/{feature}/services/{feature}.mapper.test.ts
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

### 3. Service 테스트 (DI 기반 스텁 교체)

Service는 생성자에서 `HttpClient` 인터페이스(Port)를 주입받으므로, 테스트에서는 실제 네트워크 구현체 대신 `jest.fn()` 스텁을 주입한다.
`jest.mock()`으로 모듈을 가로채는 것이 아니라, **생성자 인자를 바꿔치기**하는 방식이므로 테스트가 구현 세부사항에 결합되지 않는다.

검증 대상: **HTTP 호출 → Zod 검증 → Mapper 변환 → Result 반환** 흐름과 **Policy 검증**.

```typescript
// features/{feature}/services/{feature}.service.test.ts
import type { HttpClient } from '@src/core/ports/http';
import { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { ok, err } from '@src/shared/errors/result';

import { {Feature}Service } from './{feature}.service';

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

describe('{Feature}Service', () => {
  let httpClient: jest.Mocked<HttpClient>;
  let service: {Feature}Service;

  beforeEach(() => {
    httpClient = createMockHttpClient();
    service = new {Feature}Service(httpClient);
  });

  // 패턴 A: HTTP + Zod + Mapper
  describe('get{Feature}s', () => {
    it('정상 응답 → Zod 검증 → Domain 모델 반환', async () => {
      // Given
      httpClient.get.mockResolvedValue(ok(create{Feature}Response()));

      // When
      const result = await service.get{Feature}s(params);

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

    it('4xx API 에러 → err Result 그대로 전파', async () => {
      // Given
      httpClient.get.mockResolvedValue(
        err(new ApiError('{FEATURE}_0801', '리소스를 찾을 수 없어요', 404)),
      );

      // When
      const result = await service.get{Feature}s(params);

      // Then
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.status).toBe(404);
      }
    });

    it('Zod 검증 실패 → ParseError throw', async () => {
      // Given — 스키마에 맞지 않는 응답
      httpClient.get.mockResolvedValue(ok({ invalid: 'data' }));

      // When & Then
      await expect(service.get{Feature}s(params)).rejects.toThrow(ParseError);
    });

    it('HttpClient가 throw하면 그대로 전파', async () => {
      // Given — 5xx 서버 에러
      httpClient.get.mockRejectedValue(new ServerError(500));

      // When & Then
      await expect(service.get{Feature}s(params)).rejects.toThrow(ServerError);
    });
  });

  // 패턴 B: Policy + HTTP
  describe('create{Feature}', () => {
    it('유효한 입력이면 HTTP 호출 후 Domain 모델 반환', async () => {
      // Given
      httpClient.post.mockResolvedValue(ok(create{Feature}Response()));

      // When
      const result = await service.create{Feature}({ name: 'valid-input' });

      // Then
      expect(httpClient.post).toHaveBeenCalled();
      expect(result.ok).toBe(true);
    });

    it('무효한 입력이면 {Feature}Error 반환 + HTTP 미호출', async () => {
      // Given — 무효한 입력 (빈 문자열)

      // When
      const result = await service.create{Feature}({ name: '' });

      // Then
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('{FEATURE}_INVALID_INPUT');
      }
      expect(httpClient.post).not.toHaveBeenCalled();
    });
  });
});
```

> **핵심 검증 포인트**: Policy 실패 시 `httpClient.method`가 `not.toHaveBeenCalled()`인지 확인한다.

### 4. UI 컴포넌트 테스트

#### 네이티브 경계는 전역 setup이 담당한다 — 테스트에서 다시 mock하지 않는다

`react-native-worklets`·`@gorhom/bottom-sheet`·`react-native-keyboard-controller`·
`react-native-safe-area-context`·`react-native-gesture-handler`는 import 시점에 네이티브를
붙잡아 jest에서 그대로 터진다. 이들은 **`jest.setup.ts` 한 곳에서 각 패키지가 공식으로
제공하는 mock으로** 대체한다. 손으로 가짜를 만들거나 테스트마다 다시 mock하지 않는다.

- `moduleNameMapper`가 아니라 `jest.mock`을 쓴다 — 공식 mock 일부가 내부에서
  `jest.requireActual`로 실물을 읽는데, mapper는 그 호출까지 가로채 실물에 닿지 못하게 한다.
- 순서가 계약이다 — worklets를 먼저 막지 않으면 다른 mock도 같은 자리에서 죽는다.
- `react-native-reanimated`는 목록에 없다. 자체적으로 jest를 인식해 JS 경로로 도는 설계고,
  공식 mock으로 갈아끼우면 `useReducedMotion`처럼 heroui-native가 쓰는 API가 빠진다.

**`heroui-native`나 `@src/shared/ui`를 통째로 `jest.mock`하지 않는다.** 그렇게 하면
검증하려던 배선이 함께 사라져, 테스트는 초록인데 화면은 깨지는 상태가 된다.

#### `renderUi` — 앱과 같은 문맥에서 렌더한다

heroui-native 컴포넌트는 `HeroUINativeProvider` 없이는 애니메이션 설정을 읽다 죽고,
글꼴 배율은 `FontScaleProvider`가 소유한다. 이 문맥을 테스트마다 다시 세우지 않는다.

```tsx
import { renderUi } from '@src/shared/__tests__/render-ui';

// DI는 이 렌더가 실제로 쓰는 것만 넣는다 —
// 넣지 않은 의존성에 손대면 컨테이너가 이름을 대며 즉시 실패해 누락이 드러난다.
await renderUi(<CommentComposerSheet {...props} />, { di: { analytics } });
```

- RTL 14의 `render`·`fireEvent`는 **비동기**다. `await`하지 않으면 다음 단언이 이전 상태를 본다.
- `renderUi`는 배럴(`@src/shared/__tests__`)에 넣지 않는다 — 그러면 이 유틸을 쓰지 않는
  테스트까지 UI 스택 전체를 끌어온다.

#### QueryClient 래핑

`renderUi`가 재시도를 끈 `QueryClient`를 이미 감싸 준다. 캐시 상태를 직접 들여다봐야 할 때만
`queryClient`를 넘긴다. 아래는 `renderUi`를 쓰지 않고 직접 세울 때의 형태다.

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

// 사용
const queryClient = createTestQueryClient();
const { getByText } = render(
  <QueryClientProvider client={queryClient}>
    <MyComponent />
  </QueryClientProvider>,
);
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

> **QueryErrorBoundary 테스트**: `ThrowError` 컴포넌트 + `QueryClientProvider` 래핑으로 InfraError → fallback UI 렌더링을 검증할 수 있다. 필요 시 `shared/ui/QueryErrorBoundary/` 하위에 작성한다.

### 5. 화면(Screen) 통합 테스트 — 언제, 왜 필요한가

Screen은 여러 훅(Service, Router, Auth, Toast 등)을 조합하는 최상위 계층이다.
mock 대상이 많아 ROI가 낮으므로 **1~3번(Policy, Mapper, Service) 테스트 대비 우선순위는 높지 않다.**
핵심 비즈니스 로직이 하위 레이어에서 충분히 검증되었다면, 에러 코드별 분기나 화면 이동 조건 등 **Mutation `onError` 흐름이 복잡한 Screen** 위주로 선택적으로 작성한다.

#### mock 헬퍼 패턴

Screen은 의존하는 훅이 많으므로, mock 설정을 헬퍼로 추출하여 테스트 파일을 깔끔하게 유지한다.

```typescript
// 스텁 (DI 교체)
const stubs = {
  service: { emailLogin: jest.fn() },
  setStatus: jest.fn(),
  toast: { success: jest.fn(), error: jest.fn() },
  routerPush: jest.fn(),
};

jest.mock('@src/bootstrap/providers/di-provider', () => ({
  useAuthService: () => stubs.service,
}));
jest.mock('@src/bootstrap/providers/auth-provider', () => ({
  useAuth: () => ({ setStatus: stubs.setStatus }),
}));
// ... 나머지 훅도 동일 패턴
```

#### 반복 동작을 유틸로 추출

```typescript
function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Screen />
    </QueryClientProvider>,
  );
}

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText('이메일'), email);
  await user.type(screen.getByPlaceholderText('비밀번호'), password);
  await user.press(screen.getByText('로그인'));
}
```

#### 테스트는 사용자 플로우 중심

```typescript
describe('이메일 로그인 화면', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('유효한 자격 증명으로 로그인하면 인증 상태가 전환된다', async () => {
    // Given
    stubs.service.emailLogin.mockResolvedValue(ok({ accountRestored: false }));
    renderScreen();

    // When
    await fillAndSubmit('test@example.com', 'Test1234!');

    // Then
    await waitFor(() => {
      expect(stubs.setStatus).toHaveBeenCalledWith('authenticated');
    });
  });

  test('이메일 미인증 에러 시 인증 화면으로 이동한다', async () => {
    // Given
    stubs.service.emailLogin.mockResolvedValue(
      err(new ApiError(ErrorCode.EMAIL_0503, '이메일 인증이 필요합니다', 403)),
    );
    renderScreen();

    // When
    await fillAndSubmit('unverified@example.com', 'Test1234!');

    // Then
    await waitFor(() => {
      expect(stubs.routerPush).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: '/(auth)/verify-email' }),
      );
    });
  });
});
```

> **판단 기준**: Screen mock이 5개 이상 필요하면, 해당 Screen의 통합 테스트보다 E2E 테스트가 가성비가 더 좋다.

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

| 설정                 | 값                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------- |
| preset               | `jest-expo`                                                                        |
| testMatch            | `**/*.test.[jt]s?(x)`, `**/*.spec.[jt]s?(x)`                                       |
| setupFilesAfterSetup | (현재 주석 처리됨)                                                                 |
| moduleNameMapper     | `@aido/api-types` → packages, `@aido/utils` → packages, `expo-secure-store` → mock |

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

- [ ] 정상 응답 → Zod 검증 → Mapper → ok Result 반환
- [ ] 4xx 에러 → err Result 그대로 전파
- [ ] Zod 검증 실패 → ParseError throw
- [ ] 5xx/네트워크 → InfraError throw 전파
- [ ] Policy 검증: err Result 반환 + httpClient 미호출 확인

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

## 유틸 함수 테스트

### 테스트 대상 기준

**자체 로직이 있는 함수만 테스트한다.** 라이브러리 함수를 그대로 호출만 하는 wrapper는 테스트하지 않는다 — 라이브러리 테스트는 라이브러리에 위임한다.

| 구분            | 예시                                      | 테스트 여부 |
| --------------- | ----------------------------------------- | ----------- |
| 자체 로직 있음  | 산술 연산 + 반올림 등 자체 계산           | O           |
| 자체 로직 있음  | 조건 분기 + 포맷팅 등 비즈니스 변환       | O           |
| 라이브러리 래핑 | 라이브러리 함수를 그대로 위임하는 wrapper | X           |

### 패턴

```typescript
// src/shared/utils/{util}.test.ts
import { myUtil } from './{util}';

describe('myUtil', () => {
  it('32를 변환하면 기대 결과를 반환한다', () => {
    // Given
    const input = 32;

    // When
    const result = myUtil(input);

    // Then
    expect(result).toBe(expectedValue);
  });
});
```

### 외부 의존성 mock

React Native 모듈 등 외부 의존성은 `jest.mock`으로 격리한다.

```typescript
jest.mock('react-native', () => ({
  PixelRatio: { getFontScale: jest.fn() },
}));
```

---

## 참고 파일

| 파일                                   | 설명                             |
| -------------------------------------- | -------------------------------- |
| `src/core/ports/http.ts`               | HttpClient 인터페이스            |
| `src/core/ports/storage.ts`            | Storage 인터페이스               |
| `src/shared/errors/result.ts`          | Result 타입, ok/err/unwrap       |
| `src/shared/errors/api-error.ts`       | ApiError (서버 4xx)              |
| `src/shared/errors/infra-error.ts`     | InfraError (5xx, 네트워크, 파싱) |
| `src/features/*/models/*.model.ts`     | Domain Model + Policy            |
| `src/features/*/services/*.service.ts` | Service 구현                     |
| `src/features/*/services/*.mapper.ts`  | Mapper (DTO → Domain)            |
| `jest.config.js`                       | Jest 설정                        |
