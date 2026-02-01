# Aido Mobile App

Expo 기반 React Native 모바일 앱. Feature-based Layered Architecture + Ports & Adapters 패턴.

---

## 기술 스택

| 분류 | 라이브러리 |
|------|-----------|
| 프레임워크 | Expo SDK, React Native |
| 라우팅 | Expo Router (파일 기반) |
| 상태관리 | TanStack Query v5 |
| HTTP | Ky |
| 검증 | Zod |
| UI | HeroUI Native, NativeWind |
| DI | React Context (수동 DI) |

---

## 아키텍처 레이어

```
┌─────────────────────────────────────────────────────────────┐
│  📱 Presentation Layer                                       │
│  ├── app/                  ← Expo Router 화면 (라우트)        │
│  └── presentations/        ← 컴포넌트, React Query 훅         │
├─────────────────────────────────────────────────────────────┤
│  🔧 Application Layer                                        │
│  └── services/             ← 비즈니스 로직 조합 + DTO 변환     │
├─────────────────────────────────────────────────────────────┤
│  📦 Domain Layer                                             │
│  └── models/               ← 도메인 모델 + Zod 스키마 + Policy │
├─────────────────────────────────────────────────────────────┤
│  🔌 Infrastructure Layer                                     │
│  ├── repositories/         ← Repository 인터페이스 + 구현체    │
│  └── shared/infra/         ← HTTP 클라이언트, Storage 구현     │
├─────────────────────────────────────────────────────────────┤
│  🎯 Core Layer                                               │
│  └── core/ports/           ← 외부 의존성 추상화 인터페이스       │
├─────────────────────────────────────────────────────────────┤
│  🚀 Bootstrap Layer                                          │
│  └── bootstrap/providers/  ← DI 컨테이너, 전역 Provider        │
└─────────────────────────────────────────────────────────────┘
```

---

## Feature 구조

```
features/{feature}/
├── models/
│   ├── {feature}.model.ts      # Zod 스키마 + 타입 + Policy
│   └── {feature}.error.ts      # ClientError 클래스
├── repositories/
│   ├── {feature}.repository.ts      # 인터페이스
│   └── {feature}.repository.impl.ts # 구현체
├── services/
│   ├── {feature}.service.ts    # 비즈니스 로직
│   └── {feature}.mapper.ts     # DTO → Domain 변환
└── presentations/
    ├── constants/
    │   └── {feature}-query-keys.constant.ts
    ├── queries/
    │   ├── {action}-query-options.ts
    │   └── {action}-mutation-options.ts
    └── components/
        └── {ComponentName}.tsx
```

---

## 레이어별 패턴

### 1. Model (도메인 모델 + Policy)

```typescript
// models/{feature}.model.ts
import { z } from 'zod';

export const {Feature}Schema = z.object({
  id: z.string(),
  // ... 필드 정의
});

export type {Feature} = z.infer<typeof {Feature}Schema>;

/** {Feature} 도메인 비즈니스 규칙 */
export const {Feature}Policy = {
  /** 규칙 설명 */
  someRule: (value: string): boolean => /* 검증 로직 */,
} as const;
```

### 2. Error (클라이언트 에러)

```typescript
// models/{feature}.error.ts
import { ClientError } from '@src/shared/infra/errors/client-error';

export type {Feature}ErrorReason = 'INVALID_INPUT' | 'NOT_FOUND';

export class {Feature}ClientError extends ClientError<{Feature}ErrorReason> {
  static invalidInput() {
    return new {Feature}ClientError('INVALID_INPUT', '입력값이 올바르지 않습니다');
  }
}
```

### 3. Repository (인터페이스 + 구현체)

```typescript
// repositories/{feature}.repository.ts
export interface {Feature}Repository {
  getById(id: string): Promise<{Feature}DTO>;
  create(input: Create{Feature}Input): Promise<{Feature}DTO>;
}
```

```typescript
// repositories/{feature}.repository.impl.ts
import type { HttpClient } from '@src/core/ports/http';
import { {feature}Schema } from '@aido/validators';

export class {Feature}RepositoryImpl implements {Feature}Repository {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  async getById(id: string): Promise<{Feature}DTO> {
    const { data } = await this.#httpClient.get<{Feature}DTO>(`v1/{feature}s/${id}`);

    const result = {feature}Schema.safeParse(data);
    if (!result.success) {
      throw new Error('Invalid API response format');
    }

    return result.data;
  }
}
```

### 4. Service (비즈니스 로직)

```typescript
// services/{feature}.service.ts
import { {Feature}ClientError } from '../models/{feature}.error';
import { {Feature}Policy } from '../models/{feature}.model';
import type { {Feature}Repository } from '../repositories/{feature}.repository';
import { to{Feature} } from './{feature}.mapper';

export class {Feature}Service {
  readonly #repository: {Feature}Repository;

  constructor(repository: {Feature}Repository) {
    this.#repository = repository;
  }

  getById = async (id: string): Promise<{Feature}> => {
    const dto = await this.#repository.getById(id);
    return to{Feature}(dto);
  };

  create = async (input: CreateInput): Promise<{Feature}> => {
    if (!{Feature}Policy.someRule(input.value)) {
      throw {Feature}ClientError.invalidInput();
    }

    const dto = await this.#repository.create(input);
    return to{Feature}(dto);
  };
}
```

### 5. Mapper (DTO → Domain 변환)

```typescript
// services/{feature}.mapper.ts
import type { {Feature}DTO } from '@aido/validators';
import type { {Feature} } from '../models/{feature}.model';

export const to{Feature} = (dto: {Feature}DTO): {Feature} => ({
  id: dto.id,
  // ... 필드 매핑
  createdAt: new Date(dto.createdAt), // 문자열 → Date 변환
});
```

### 6. Query Keys

```typescript
// presentations/constants/{feature}-query-keys.constant.ts
export const {FEATURE}_QUERY_KEYS = {
  all: ['{feature}'] as const,
  list: () => [...{FEATURE}_QUERY_KEYS.all, 'list'] as const,
  detail: (id: string) => [...{FEATURE}_QUERY_KEYS.all, 'detail', id] as const,
} as const;
```

### 7. Query/Mutation Options

```typescript
// presentations/queries/get-{feature}-query-options.ts
import { use{Feature}Service } from '@src/bootstrap/providers/di-provider';
import { queryOptions } from '@tanstack/react-query';
import { {FEATURE}_QUERY_KEYS } from '../constants/{feature}-query-keys.constant';

export const get{Feature}QueryOptions = (id: string) => {
  const service = use{Feature}Service();

  return queryOptions({
    queryKey: {FEATURE}_QUERY_KEYS.detail(id),
    queryFn: () => service.getById(id),
  });
};
```

```typescript
// presentations/queries/create-{feature}-mutation-options.ts
import { use{Feature}Service } from '@src/bootstrap/providers/di-provider';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import { {FEATURE}_QUERY_KEYS } from '../constants/{feature}-query-keys.constant';

export const create{Feature}MutationOptions = () => {
  const service = use{Feature}Service();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: service.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: {FEATURE}_QUERY_KEYS.all });
    },
  });
};
```

---

## 파일 네이밍 규칙

| 파일 유형 | 패턴 | 예시 |
|----------|------|------|
| 모델 | `{feature}.model.ts` | `todo.model.ts` |
| 에러 | `{feature}.error.ts` | `todo.error.ts` |
| 서비스 | `{feature}.service.ts` | `todo.service.ts` |
| 매퍼 | `{feature}.mapper.ts` | `todo.mapper.ts` |
| Repository 인터페이스 | `{feature}.repository.ts` | `todo.repository.ts` |
| Repository 구현 | `{feature}.repository.impl.ts` | `todo.repository.impl.ts` |
| Query Options | `{action}-query-options.ts` | `get-todos-query-options.ts` |
| Mutation Options | `{action}-mutation-options.ts` | `create-todo-mutation-options.ts` |
| Query Keys | `{feature}-query-keys.constant.ts` | `todo-query-keys.constant.ts` |

---

## 새 Feature 추가 체크리스트

### 1단계: 도메인 정의
- [ ] `features/{feature}/models/{feature}.model.ts` 생성
  - Zod 스키마 정의
  - 타입 export
  - Policy 정의 (비즈니스 규칙)
- [ ] `features/{feature}/models/{feature}.error.ts` 생성
  - ErrorReason 타입 정의
  - ClientError 클래스 정의

### 2단계: 데이터 레이어
- [ ] `features/{feature}/repositories/{feature}.repository.ts` 생성
  - Repository 인터페이스 정의
- [ ] `features/{feature}/repositories/{feature}.repository.impl.ts` 생성
  - HttpClient 주입
  - Zod safeParse로 응답 검증

### 3단계: 비즈니스 로직
- [ ] `features/{feature}/services/{feature}.mapper.ts` 생성
  - DTO → Domain 변환 함수
- [ ] `features/{feature}/services/{feature}.service.ts` 생성
  - Repository 주입
  - Policy 검증 적용
  - Mapper로 변환 후 반환

### 4단계: DI 등록
- [ ] `bootstrap/providers/di-provider.tsx` 수정
  - Repository 인스턴스 생성
  - Service 인스턴스 생성
  - DIContainer 인터페이스에 추가
  - `use{Feature}Service` 훅 export

### 5단계: Presentation
- [ ] `features/{feature}/presentations/constants/{feature}-query-keys.constant.ts` 생성
- [ ] `features/{feature}/presentations/queries/` 에 Query/Mutation Options 생성
- [ ] `features/{feature}/presentations/components/` 에 컴포넌트 생성

### 6단계: 라우트
- [ ] `app/` 하위에 화면 추가

---

## 의존성 방향

```
UI (app/, presentations/)
        ↓
    Service
        ↓
    Repository (인터페이스)
        ↓
    Repository.impl → HttpClient (Port)
                            ↓
                      KyHttpClient (Adapter)
```

**규칙**: 상위 레이어는 하위 레이어만 의존. 역방향 의존 금지.
