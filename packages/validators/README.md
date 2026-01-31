# @aido/validators

Zod 4.3 기반 공유 스키마 패키지. 프론트엔드/백엔드 타입 안전 검증.

## 설치

```json
{
  "dependencies": {
    "@aido/validators": "workspace:*"
  }
}
```

## 사용법

### 타입 Import

```typescript
import type { Todo, TodoCreate, PaginationQuery } from '@aido/validators';
```

### 스키마 Import

```typescript
import { todoSchema, todoCreateSchema } from '@aido/validators';
```

### 검증

```typescript
const result = todoCreateSchema.safeParse(formData);

if (!result.success) {
  const errors = result.error.flatten().fieldErrors;
  return;
}

const validData = result.data;
```

## 구조

```
src/
├── common/       # 페이지네이션, 정렬 쿼리
├── domains/      # 도메인별 스키마
└── index.ts
```

## 스키마

### Common

| 스키마 | 설명 |
|--------|------|
| `paginationQuerySchema` | 페이지네이션 (page, size) |
| `sortQuerySchema` | 정렬 (sortBy, sortOrder) |

### Todo

| 스키마 | 설명 |
|--------|------|
| `todoSchema` | Todo 엔티티 |
| `todoCreateSchema` | Todo 생성 DTO |
| `todoUpdateSchema` | Todo 수정 DTO |

## NestJS 연동

```typescript
import { createZodDto } from 'nestjs-zod';
import { todoCreateSchema } from '@aido/validators';

class CreateTodoDto extends createZodDto(todoCreateSchema) {}
```

## React Native 연동

```typescript
import { todoCreateSchema } from '@aido/validators';

const handleSubmit = () => {
  const result = todoCreateSchema.safeParse({ title, content });
  if (!result.success) return;
  await api.createTodo(result.data);
};
```
