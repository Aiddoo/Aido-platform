# Mobile 테스트 전략

**Version**: 1.0.0 · **Last Updated**: 2026-04-23 · **Owner**: Aido Mobile Team

> Hexagonal Architecture 기반 React Native 앱의 테스트 전략

---

## 테스트 환경

| 항목            | 설정                                           |
| --------------- | ---------------------------------------------- |
| 프레임워크      | Jest + jest-expo                               |
| 컴포넌트 테스트 | @testing-library/react-native                  |
| 타입체크        | TypeScript strict mode                         |
| mock 초기화     | `clearMocks: true`, `restoreMocks: true`       |
| 경로 별칭       | `@src/*`, `@/*`, `@assets/*` + 모노레포 패키지 |

```bash
# 전체 테스트
pnpm test

# 개별 테스트
pnpm test -- --testPathPattern="auth.service"

# 커버리지
pnpm test -- --coverage
```

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

| 우선순위 | 레이어          | mock       | ROI  | 이유                          |
| -------- | --------------- | ---------- | ---- | ----------------------------- |
| 1        | **Policy**      | 없음       | 최고 | 순수 함수, 비즈니스 핵심      |
| 2        | **Mapper**      | 없음       | 높음 | 서버 변경 감지의 방파제       |
| 3        | **Service**     | Repository | 중간 | Policy + Repository 위임 검증 |
| 4        | **Repository**  | HttpClient | 중간 | API 호출 + Zod 검증           |
| 5        | **UI 컴포넌트** | Service 훅 | 낮음 | 렌더링 + 인터랙션             |

---

## 파일 구조 & 네이밍

```
src/features/{feature}/
├── models/
│   └── {feature}.model.test.ts        # Policy 테스트
├── services/
│   ├── {feature}.mapper.test.ts       # Mapper 테스트
│   └── {feature}.service.test.ts      # Service 테스트
├── repositories/
│   └── {feature}.repository.impl.test.ts  # Repository 테스트
├── presentations/
│   └── components/
│       └── {Component}.test.tsx       # UI 컴포넌트 테스트
└── __tests__/
    └── {feature}.factories.ts         # 테스트 데이터 팩토리

src/shared/
├── ui/{Component}/{Component}.test.tsx  # 공유 UI 컴포넌트 테스트
├── utils/*.test.ts                      # 유틸리티 테스트
└── __tests__/
    ├── create-mock-http-client.ts       # HttpClient mock
    ├── create-mock-storage.ts           # Storage mock
    ├── index.ts                         # barrel export
    └── mocks/
        └── expo-secure-store.ts         # native 모듈 mock
```

**규칙:**

- 테스트 파일은 **대상 파일과 같은 디렉토리**에 배치 (co-located)
- `.spec.ts` 가 아니라 **`.test.ts`** / **`.test.tsx`** 사용
- `describe`/`it`은 **한국어**로 작성

---

## 공통 패턴

### Given-When-Then 구조

모든 테스트에 `// Given`, `// When`, `// Then` 주석으로 구분:

```typescript
it('유효한 비밀번호는 모든 규칙을 통과한다', () => {
  // Given
  const password = 'Password1!';

  // When
  const result = PasswordPolicy.isValid(password);

  // Then
  expect(result).toBe(true);
});
```

### 성공 + 실패 케이스 필수

모든 `describe` 블록에 최소 **성공 1개 + 실패 1개**:

| 레이어     | 성공 케이스                      | 실패 케이스                                |
| ---------- | -------------------------------- | ------------------------------------------ |
| Policy     | `isValid('Password1!')` → `true` | `isValid('')` → `false`                    |
| Mapper     | 정상 DTO → Domain 변환           | nullable 필드가 null인 경우                |
| Service    | Repository 성공 → ok 전파        | Policy 실패 → err + Repository 미호출      |
| Repository | ok Response → ok Result          | 4xx → err Result, 잘못된 응답 → ParseError |

---

## 레이어별 테스트 패턴

### 1. Policy (순수 함수, mock 없음)

비즈니스 규칙의 핵심. 입력 → 출력만 검증.

```typescript
// auth.model.test.ts
describe('PasswordPolicy', () => {
  describe('hasLetter', () => {
    test.each(['a', 'Z', 'Password1'])('"%s"는 영문을 포함하므로 true', (pw) => {
      expect(hasLetter(pw)).toBe(true);
    });

    test.each(['123', '!@#'])('"%s"는 영문이 없으므로 false', (pw) => {
      expect(hasLetter(pw)).toBe(false);
    });
  });
});
```

### 2. Mapper (순수 함수, mock 없음)

DTO → Domain 변환 검증. 서버 응답 스키마 변경 시 가장 먼저 실패.

```typescript
// auth.mapper.test.ts
describe('toAuthTokens', () => {
  it('DTO를 도메인 모델로 변환한다', () => {
    // Given
    const dto = createAuthTokensDto({ name: 'Kim', profileImage: 'url' });

    // When
    const result = toAuthTokens(dto);

    // Then
    expect(result).toEqual({
      accessToken: dto.accessToken,
      refreshToken: dto.refreshToken,
      userId: dto.userId,
      userTag: dto.userTag,
      userName: 'Kim', // name → userName 리네이밍
      userProfileImage: 'url', // profileImage → userProfileImage
      accountRestored: false,
    });
  });

  it('name이 null이면 userName도 null이다', () => {
    const dto = createAuthTokensDto({ name: null, profileImage: null });
    const result = toAuthTokens(dto);
    expect(result.userName).toBeNull();
    expect(result.userProfileImage).toBeNull();
  });
});
```

### 3. Service (mock Repository)

Policy 검증 → Repository 위임 → 부수효과 (토큰 저장 등) 검증.

```typescript
// auth.service.test.ts
describe('AuthService', () => {
  let service: AuthService;
  let publicHttpClient: jest.Mocked<HttpClient>;
  let storage: jest.Mocked<Storage>;

  beforeEach(() => {
    publicHttpClient = createMockHttpClient();
    storage = createMockStorage();
    service = new AuthService(publicHttpClient, authHttpClient, storage);
  });

  describe('emailLogin', () => {
    it('정상 응답 → 토큰 저장 + 도메인 모델 반환', async () => {
      // Given
      const dto = createAuthTokensDto();
      publicHttpClient.post.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.emailLogin('test@example.com', 'password');

      // Then
      expect(result.ok).toBe(true);
      expect(storage.set).toHaveBeenCalledWith('accessToken', dto.accessToken);
      expect(storage.set).toHaveBeenCalledWith('refreshToken', dto.refreshToken);
    });

    it('HTTP 에러 → Result.err + 토큰 미저장', async () => {
      // Given
      const apiError = createAuthApiError();
      publicHttpClient.post.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.emailLogin('test@example.com', 'wrong');

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
      expect(storage.set).not.toHaveBeenCalled();
    });

    it('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      publicHttpClient.post.mockResolvedValue({ ok: true, value: {} });

      // When & Then
      await expect(service.emailLogin('a@b.com', 'pw')).rejects.toThrow();
    });
  });
});
```

### 4. UI 컴포넌트 (mock Service 훅)

```typescript
// Button.test.tsx
describe('Button', () => {
  test('children을 렌더링한다', () => {
    render(<Button>버튼</Button>);
    expect(screen.getByText('버튼')).toBeTruthy();
  });

  test('isLoading일 때 Spinner를 표시하고 children을 숨긴다', () => {
    render(<Button isLoading>로딩</Button>);
    expect(screen.getByTestId('spinner')).toBeTruthy();
    expect(screen.queryByText('로딩')).toBeNull();
  });
});
```

---

## 테스트 데이터 관리

### Factory 함수 패턴

```typescript
// features/auth/__tests__/auth.factories.ts

/** DTO (서버 응답) 팩토리 */
export const createAuthTokensDto = (overrides?: Partial<AuthTokensDto>): AuthTokensDto => ({
  userId: 'user-123',
  userTag: 'test#1234',
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  name: 'Test User',
  profileImage: null,
  accountRestored: false,
  ...overrides,
});

/** API 에러 팩토리 */
export const createAuthApiError = (overrides?: Partial<ApiError>): ApiError =>
  new ApiError(
    overrides?.code ?? 'USER_0602',
    overrides?.message ?? '이메일 또는 비밀번호를 확인해주세요',
    overrides?.status ?? 401,
  );
```

**사용법:**

```typescript
const dto = createAuthTokensDto(); // 기본값
const restoredDto = createAuthTokensDto({ accountRestored: true }); // 오버라이드
```

### Mock 유틸리티

```typescript
// shared/__tests__/create-mock-http-client.ts
export const createMockHttpClient = (): jest.Mocked<HttpClient> => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
});

// shared/__tests__/create-mock-storage.ts
export const createMockStorage = (): jest.Mocked<Storage> => ({
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
  clear: jest.fn(),
});
```

---

## 에러 처리 테스트

3가지 에러 트랙을 모두 테스트:

| 트랙                   | 에러                         | 테스트 위치        | 검증 방법                                           |
| ---------------------- | ---------------------------- | ------------------ | --------------------------------------------------- |
| 4xx ApiError           | `Result.err(ApiError)`       | Service/Repository | `expect(result.ok).toBe(false)`                     |
| 5xx/Network InfraError | `throw InfraError`           | Service/Repository | `rejects.toThrow()`                                 |
| Policy 실패            | `Result.err({Feature}Error)` | Service            | `expect(result.ok).toBe(false)` + Repository 미호출 |

```typescript
// 부수효과 보장 테스트 (로그아웃: API 실패해도 토큰 삭제)
it('API 실패해도 토큰 삭제 (finally 보장)', async () => {
  authHttpClient.post.mockResolvedValue({ ok: false, error: apiError });

  const result = await service.logout();

  expect(storage.remove).toHaveBeenCalledWith('accessToken'); // 삭제됨
  expect(storage.remove).toHaveBeenCalledWith('refreshToken'); // 삭제됨
  expect(result).toEqual({ ok: false, error: apiError });
});
```

---

## 현재 테스트 현황

### 테스트 파일 (20 suites, 228 tests)

| 카테고리                    | 파일 수 | 테스트 수 |
| --------------------------- | ------- | --------- |
| Auth (Service/Mapper/Model) | 3       | ~90       |
| User (Service/Mapper/Model) | 3       | ~30       |
| Todo (Utility)              | 2       | ~20       |
| Shared UI 컴포넌트          | 11      | ~80       |
| Shared 유틸리티             | 1       | ~8        |

### 아직 미작성

| 레이어      | 대상                       | 우선순위 |
| ----------- | -------------------------- | -------- |
| Repository  | Auth, User, Todo, Friend   | 높음     |
| Service     | Todo, Friend, Notification | 중간     |
| Policy      | Todo, Friend               | 높음     |
| Mapper      | Todo, Friend, Notification | 중간     |
| UI 컴포넌트 | 주요 Screen 컴포넌트       | 낮음     |

---

## 참고

- 에러 처리 상세: [error-handling.md](./error-handling.md)
- 아키텍처 상세: [.claude/architecture.md](../.claude/architecture.md)
- 테스트 작성 가이드 (AI 에이전트용): [.claude/testing-guide.md](../.claude/testing-guide.md)
