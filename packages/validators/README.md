# @aido/validators

공유 Zod 스키마 패키지 - API/Mobile 간 타입 안전성 보장

## 설계 철학

```
┌─────────────────────────────────────────────────────────────┐
│                    @aido/validators                         │
│                   (Single Source of Truth)                  │
├─────────────────────────────────────────────────────────────┤
│  Zod Schema → TypeScript Type + Runtime Validation          │
└─────────────────────────────────────────────────────────────┘
                    ↓                    ↓
            ┌──────────────┐      ┌──────────────┐
            │   apps/api   │      │ apps/mobile  │
            │  (NestJS)    │      │   (Expo)     │
            └──────────────┘      └──────────────┘
```

**핵심 원칙:**

1. **단일 소스** - 스키마 하나로 타입과 검증 모두 해결
2. **타입 추출** - `z.infer<typeof schema>`로 타입 자동 생성
3. **런타임 검증** - API 요청/응답 검증에 동일 스키마 사용
4. **일관성 보장** - Frontend/Backend 간 타입 불일치 방지

## 빠른 시작

```typescript
// 타입만 필요한 경우 (번들 크기 최소화)
import type { Todo, TodoCreate, ApiResponse } from "@aido/validators";

// 런타임 검증이 필요한 경우
import { todoSchema, todoCreateSchema } from "@aido/validators";

// 검증 예시
const result = todoCreateSchema.safeParse(userInput);
if (result.success) {
  // result.data는 TodoCreate 타입
}
```

## 스키마 구조

```
src/
├── index.ts           # 메인 export
├── common/            # 공통 스키마
│   ├── error.ts       # 에러 응답
│   ├── query.ts       # 쿼리 파라미터
│   └── response.ts    # API 응답 래퍼
└── todo/              # Todo 도메인
    └── index.ts       # Todo 스키마
```

## 스키마 상세

### Common 스키마

#### 에러 응답

| 스키마                 | 설명           | 필드                                   |
| ---------------------- | -------------- | -------------------------------------- |
| `apiErrorDetailSchema` | 에러 상세      | `code`, `message`, `details?`          |
| `apiErrorSchema`       | 에러 응답 전체 | `success: false`, `error`, `timestamp` |

```typescript
// 에러 응답 예시
{
  success: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: '입력값이 올바르지 않습니다',
    details: { field: 'title', issue: 'required' }
  },
  timestamp: '2024-01-01T00:00:00.000Z'
}
```

#### 쿼리 파라미터

| 스키마                  | 설명         | 필드                                         |
| ----------------------- | ------------ | -------------------------------------------- |
| `paginationQuerySchema` | 페이지네이션 | `page` (기본 1), `limit` (기본 20, 최대 100) |
| `sortQuerySchema`       | 정렬         | `sortBy?`, `sortOrder` (asc/desc)            |
| `commonQuerySchema`     | 통합 쿼리    | 위 둘 병합                                   |

```typescript
// 쿼리 파라미터 검증
const query = commonQuerySchema.parse({
  page: "2", // z.coerce로 number 변환
  limit: "10",
  sortBy: "createdAt",
  sortOrder: "desc",
});
```

#### API 응답

| 스키마/함수                        | 설명                                                       |
| ---------------------------------- | ---------------------------------------------------------- |
| `paginationMetaSchema`             | 페이지네이션 메타 (`total`, `page`, `limit`, `totalPages`) |
| `createApiResponseSchema(T)`       | 성공 응답 팩토리                                           |
| `createPaginatedResponseSchema(T)` | 페이지네이션 응답 팩토리                                   |

```typescript
// 커스텀 응답 스키마 생성
const todoResponseSchema = createApiResponseSchema(todoSchema);
const todoListResponseSchema = createApiResponseSchema(
  createPaginatedResponseSchema(todoSchema)
);
```

### Todo 스키마

| 스키마             | 용도        | 필드                                                            |
| ------------------ | ----------- | --------------------------------------------------------------- |
| `todoSchema`       | 전체 엔티티 | `id`, `title`, `content`, `completed`, `createdAt`, `updatedAt` |
| `todoCreateSchema` | 생성 요청   | `title` (1-100자, 필수), `content?` (최대 500자)                |
| `todoUpdateSchema` | 수정 요청   | 모두 optional: `title?`, `content?`, `completed?`               |

#### 필드 상세

| 필드        | 타입             | 제약조건          |
| ----------- | ---------------- | ----------------- |
| `id`        | `number`         | 양수 정수         |
| `title`     | `string`         | 1-100자           |
| `content`   | `string \| null` | 최대 500자        |
| `completed` | `boolean`        | -                 |
| `createdAt` | `string`         | ISO 8601 datetime |
| `updatedAt` | `string`         | ISO 8601 datetime |

## 사용 예시

### NestJS (Backend)

```typescript
// dto/create-todo.dto.ts
import { createZodDto } from '@anatine/zod-nestjs';
import { todoCreateSchema } from '@aido/validators';

export class CreateTodoDto extends createZodDto(todoCreateSchema) {}

// todo.controller.ts
@Post()
async create(@Body() dto: CreateTodoDto): Promise<ApiResponse<Todo>> {
  return this.todoService.create(dto);
}
```

### Expo (Mobile)

```typescript
// hooks/useTodos.ts
import type { Todo, TodoCreate, ApiResponse } from "@aido/validators";

async function createTodo(data: TodoCreate): Promise<Todo> {
  const response = await fetch("/api/todos", {
    method: "POST",
    body: JSON.stringify(data),
  });
  const result: ApiResponse<Todo> = await response.json();
  return result.data;
}
```

### React Hook Form 연동

```typescript
import { zodResolver } from "@hookform/resolvers/zod";
import { todoCreateSchema, type TodoCreate } from "@aido/validators";

function TodoForm() {
  const { register, handleSubmit } = useForm<TodoCreate>({
    resolver: zodResolver(todoCreateSchema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register("title")} />
      <textarea {...register("content")} />
    </form>
  );
}
```

## 커스텀 스키마 작성 가이드

### 새 도메인 스키마 추가

```typescript
// src/user/index.ts
import { z } from "zod";

// 1. 엔티티 스키마 정의
export const userSchema = z.object({
  id: z.number().int().positive(),
  email: z.string().email(),
  name: z.string().min(1).max(50),
  createdAt: z.string().datetime(),
});

// 2. 타입 추출
export type User = z.infer<typeof userSchema>;

// 3. 생성/수정 스키마 (필요한 필드만)
export const userCreateSchema = userSchema.pick({
  email: true,
  name: true,
});

export type UserCreate = z.infer<typeof userCreateSchema>;

// 4. index.ts에서 export
// export * from './user';
```

### 스키마 작성 규칙

1. **파일 위치** - 도메인별 폴더 (`src/{domain}/index.ts`)
2. **네이밍** - `{entity}Schema`, `{entity}CreateSchema`, `{entity}UpdateSchema`
3. **타입 export** - 스키마와 함께 `type` export
4. **검증 메시지** - 한국어 에러 메시지 사용
5. **날짜 필드** - `z.string().datetime()` (JSON 직렬화 고려)

## 타입 목록

### Common Types

| 타입                   | 설명                       |
| ---------------------- | -------------------------- |
| `ApiError`             | 에러 응답                  |
| `ApiErrorDetail`       | 에러 상세                  |
| `PaginationQuery`      | 페이지네이션 쿼리          |
| `SortQuery`            | 정렬 쿼리                  |
| `CommonQuery`          | 통합 쿼리                  |
| `PaginationMeta`       | 페이지네이션 메타          |
| `ApiResponse<T>`       | 성공 응답 (제네릭)         |
| `PaginatedResponse<T>` | 페이지네이션 응답 (제네릭) |

### Todo Types

| 타입         | 설명             |
| ------------ | ---------------- |
| `Todo`       | Todo 엔티티 전체 |
| `TodoCreate` | Todo 생성 입력   |
| `TodoUpdate` | Todo 수정 입력   |
