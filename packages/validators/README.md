# @aido/validators

> Zod 스키마 기반 공유 검증 패키지

![Version](https://img.shields.io/badge/version-0.0.0-blue.svg)
![Zod](https://img.shields.io/badge/Zod-3.x-3068B7.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## 개요

프론트엔드와 백엔드에서 공유하는 Zod 스키마 패키지입니다. 타입 안전한 입력 검증과 TypeScript 타입 추출을 제공합니다.

## 주요 기능

- **Request DTO 스키마**: create, update 요청 검증
- **엔티티 스키마**: 응답 데이터 검증
- **쿼리 파라미터 스키마**: pagination, sort 파라미터
- **타입 자동 추출**: `z.infer<>` 기반 TypeScript 타입

## 설치

이 패키지는 모노레포 내부 패키지로, 워크스페이스에서 자동으로 사용 가능합니다.

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
import type { 
  Todo, 
  TodoCreate, 
  TodoUpdate,
  PaginationQuery,
  SortQuery 
} from '@aido/validators';
```

### 스키마 Import (런타임 검증)

```typescript
import { 
  todoSchema, 
  todoCreateSchema, 
  paginationQuerySchema 
} from '@aido/validators';
```

### 검증 예시

```typescript
import { todoCreateSchema } from '@aido/validators';

// 폼 데이터 검증
const result = todoCreateSchema.safeParse(formData);

if (!result.success) {
  // Zod 에러 처리
  const errors = result.error.flatten().fieldErrors;
  console.log(errors);
  return;
}

// 검증 통과 - 타입 안전
const validData = result.data;
```

## 프로젝트 구조

```
src/
├── common/                 # 공통 스키마
│   ├── query.ts           # 페이지네이션, 정렬 쿼리
│   └── index.ts
├── domains/                # 도메인별 스키마
│   └── todo/
│       ├── todo.schema.ts # Todo 엔티티 스키마
│       ├── todo.dto.ts    # Todo DTO 스키마
│       └── index.ts
├── utils/                  # 유틸리티
│   └── index.ts
└── index.ts               # 메인 진입점
```

## 제공 스키마

### Common

| 스키마 | 타입 | 설명 |
|--------|------|------|
| `paginationQuerySchema` | `PaginationQuery` | 페이지네이션 (page, size) |
| `sortQuerySchema` | `SortQuery` | 정렬 (sortBy, sortOrder) |
| `commonQuerySchema` | `CommonQuery` | 페이지네이션 + 정렬 통합 |

### Todo

| 스키마 | 타입 | 설명 |
|--------|------|------|
| `todoSchema` | `Todo` | Todo 엔티티 |
| `todoCreateSchema` | `TodoCreate` | Todo 생성 DTO |
| `todoUpdateSchema` | `TodoUpdate` | Todo 수정 DTO |
| `todoVisibilitySchema` | `TodoVisibility` | 공개 범위 enum |

## 스키마 상세

### PaginationQuery

```typescript
{
  page: number;    // 페이지 번호 (기본값: 1)
  size: number;    // 페이지 크기 (기본값: 20, 최대: 100)
}
```

### Todo

```typescript
{
  id: string;           // CUID
  userId: string;       // 사용자 ID
  title: string;        // 제목 (최대 200자)
  content: string | null;      // 내용 (최대 5000자)
  color: string | null;        // HEX 색상 (#FF5733)
  completed: boolean;          // 완료 여부
  completedAt: Date | null;    // 완료 시간
  startDate: Date;             // 시작일
  endDate: Date | null;        // 종료일
  scheduledTime: Date | null;  // 예정 시간
  isAllDay: boolean;           // 종일 여부
  visibility: 'PUBLIC' | 'PRIVATE';  // 공개 범위
  createdAt: Date;
  updatedAt: Date;
}
```

## 스크립트

```bash
pnpm build        # TypeScript 빌드
pnpm dev          # Watch 모드 빌드
pnpm typecheck    # 타입 체크
pnpm check        # Biome 린트
pnpm test         # Vitest 테스트
```

## NestJS 연동

nestjs-zod와 함께 사용:

```typescript
// todo.controller.ts
import { createZodDto } from 'nestjs-zod';
import { todoCreateSchema } from '@aido/validators';

class CreateTodoDto extends createZodDto(todoCreateSchema) {}

@Post()
async create(@Body() dto: CreateTodoDto) {
  // dto는 자동으로 검증됨
  return this.todoService.create(dto);
}
```

## React Native 연동

폼 검증에 활용:

```typescript
import { todoCreateSchema } from '@aido/validators';

const handleSubmit = () => {
  const result = todoCreateSchema.safeParse({
    title: titleInput,
    content: contentInput,
  });

  if (!result.success) {
    setErrors(result.error.flatten().fieldErrors);
    return;
  }

  // API 호출
  await api.createTodo(result.data);
};
```

## 변경 이력

### v0.0.0 (2025-01-13)

- 초기 릴리즈
- Zod 기반 스키마 시스템 구축
- Todo 도메인 스키마 (entity, create, update)
- 공통 쿼리 스키마 (pagination, sort)
- TypeScript 타입 자동 추출
