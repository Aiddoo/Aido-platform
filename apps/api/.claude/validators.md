# @aido/validators 패키지 규칙

> Zod 스키마 중앙 관리 및 클라이언트-서버 타입 공유

## 관련 문서

| 문서 | 설명 |
|------|------|
| [architecture.md](./architecture.md) | 전체 아키텍처 개요 |
| [api-conventions.md](./api-conventions.md) | Controller/Service/Repository 규칙 |

---

## 왜 validators 패키지인가?

### 타입 공유의 이점

| 이점 | 설명 |
|------|------|
| **타입 안전성** | 클라이언트-서버 간 타입 불일치로 인한 런타임 에러 방지 |
| **자동 완성** | IDE에서 요청/응답 필드를 자동 완성 |
| **유효성 검증 재사용** | 동일한 Zod 스키마로 클라이언트/서버 양쪽에서 검증 |
| **API 문서 자동 생성** | `.describe()`로 OpenAPI 문서 자동 생성 |
| **리팩토링 안전성** | 스키마 변경 시 양쪽에서 타입 에러 감지 |

### 아키텍처 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│                    @aido/validators                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Zod 스키마 + TypeScript 타입 (Single Source of Truth)   │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
┌───────────────────────┐       ┌───────────────────────┐
│   클라이언트 (Mobile)  │       │   서버 (NestJS API)   │
│                       │       │                       │
│  - 요청 데이터 타입    │       │  - DTO 자동 생성      │
│  - 응답 데이터 타입    │       │  - 요청 검증          │
│  - 클라이언트 검증     │       │  - Swagger 문서       │
└───────────────────────┘       └───────────────────────┘
```

---

## 클라이언트-서버 타입 공유 예시

### 1. 스키마 정의 (validators 패키지)

```typescript
// packages/validators/src/domains/todo/todo.request.ts

import { z } from 'zod';

/** Todo 생성 요청 스키마 */
export const createTodoSchema = z
  .object({
    title: z
      .string()
      .min(1, '제목은 필수입니다')
      .max(200, '제목은 200자 이내')
      .describe('할 일 제목'),
    content: z
      .string()
      .max(5000, '내용은 5000자 이내')
      .optional()
      .describe('상세 내용'),
    dueDate: z
      .string()
      .datetime()
      .optional()
      .describe('마감일'),
  })
  .describe('Todo 생성 요청');

// 타입 자동 추론
export type CreateTodoInput = z.infer<typeof createTodoSchema>;
```

```typescript
// packages/validators/src/domains/todo/todo.response.ts

import { z } from 'zod';

/** Todo 응답 스키마 */
export const todoResponseSchema = z
  .object({
    id: z.string().cuid().describe('고유 ID'),
    title: z.string().describe('제목'),
    content: z.string().nullable().describe('내용'),
    completed: z.boolean().describe('완료 여부'),
    dueDate: z.string().datetime().nullable().describe('마감일'),
    createdAt: z.string().datetime().describe('생성일시'),
    updatedAt: z.string().datetime().describe('수정일시'),
  })
  .describe('Todo 응답');

// 타입 자동 추론
export type TodoResponse = z.infer<typeof todoResponseSchema>;
```

### 2. 서버 사용 예시 (NestJS)

```typescript
// apps/api/src/modules/todo/todo.controller.ts

import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateTodoDto, TodoResponseDto } from '@aido/validators/nestjs';
import { TodoService } from './todo.service';

@ApiTags('todos')
@Controller('todos')
export class TodoController {
  constructor(private readonly todoService: TodoService) {}

  @Post()
  async create(@Body() dto: CreateTodoDto): Promise<TodoResponseDto> {
    // dto는 Zod 스키마로 자동 검증됨
    // 잘못된 데이터 → 400 Bad Request 자동 반환
    return this.todoService.create(dto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<TodoResponseDto> {
    return this.todoService.findById(id);
  }
}
```

```typescript
// apps/api/src/modules/todo/todo.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateTodoInput, TodoResponse } from '@aido/validators';
import { TodoRepository } from './todo.repository';

@Injectable()
export class TodoService {
  constructor(private readonly todoRepository: TodoRepository) {}

  async create(input: CreateTodoInput): Promise<TodoResponse> {
    // CreateTodoInput 타입으로 안전하게 사용
    const todo = await this.todoRepository.create(input);
    return todo;
  }

  async findById(id: string): Promise<TodoResponse> {
    const todo = await this.todoRepository.findById(id);
    if (!todo) {
      throw new NotFoundException('Todo를 찾을 수 없습니다');
    }
    return todo;
  }
}
```

### 3. 클라이언트 사용 예시 (React Native / Axios)

```typescript
// apps/mobile/src/api/todo.api.ts

import axios from 'axios';
import { 
  createTodoSchema,
  CreateTodoInput, 
  TodoResponse,
} from '@aido/validators';

const api = axios.create({
  baseURL: 'https://api.example.com',
});

/** Todo 생성 API */
export async function createTodo(input: CreateTodoInput): Promise<TodoResponse> {
  // 클라이언트에서도 동일한 스키마로 사전 검증 가능
  const validated = createTodoSchema.parse(input);
  
  const { data } = await api.post<{ data: TodoResponse }>('/todos', validated);
  return data.data;
}

/** Todo 목록 조회 API */
export async function getTodos(): Promise<TodoResponse[]> {
  const { data } = await api.get<{ data: TodoResponse[] }>('/todos');
  return data.data;
}

/** Todo 상세 조회 API */
export async function getTodo(id: string): Promise<TodoResponse> {
  const { data } = await api.get<{ data: TodoResponse }>(`/todos/${id}`);
  return data.data;
}
```

```typescript
// apps/mobile/src/screens/CreateTodoScreen.tsx

import { useState } from 'react';
import { createTodoSchema, CreateTodoInput } from '@aido/validators';
import { createTodo } from '../api/todo.api';

export function CreateTodoScreen() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async () => {
    // 클라이언트 사전 검증
    const result = createTodoSchema.safeParse({ title, content });
    
    if (!result.success) {
      // Zod 에러를 폼 에러로 변환
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as string;
        fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    // 검증 통과 → API 호출
    try {
      const todo = await createTodo(result.data);
      // 성공 처리...
    } catch (error) {
      // 에러 처리...
    }
  };

  return (
    // UI 구현...
  );
}
```

### 4. React Hook Form + Zod 연동

```typescript
// apps/mobile/src/hooks/useCreateTodoForm.ts

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createTodoSchema, CreateTodoInput } from '@aido/validators';

export function useCreateTodoForm() {
  return useForm<CreateTodoInput>({
    resolver: zodResolver(createTodoSchema),
    defaultValues: {
      title: '',
      content: '',
    },
  });
}
```

---

## 패키지 구조

```
packages/validators/src/
├── domains/                    # 도메인별 Zod 스키마
│   └── {name}/
│       ├── {name}.constants.ts # 상수 정의
│       ├── {name}.request.ts   # Request 스키마
│       ├── {name}.response.ts  # Response 스키마
│       └── index.ts            # 도메인 re-export
├── nestjs/                     # NestJS DTO 클래스
│   └── domains/
│       └── {name}/
│           ├── {name}.request.dto.ts   # Request DTO
│           ├── {name}.response.dto.ts  # Response DTO
│           └── index.ts
├── common/                     # 공통 스키마 (datetime, query 등)
├── utils/                      # 유틸리티 함수
└── index.ts                    # 메인 entrypoint
```

---

## Zod 스키마 작성 규칙

### 필수 규칙

| 규칙 | 설명 |
|------|------|
| `.describe()` 필수 | OpenAPI 문서 자동 생성 |
| JSDoc 주석 | 스키마 그룹 구분 |
| 공통 스키마 재사용 | `emailSchema`, `passwordSchema` 등 |
| Type export | `z.infer<typeof schema>` 사용 |

### 스키마 파일 구조

```typescript
// domains/{name}/{name}.request.ts

import { z } from 'zod';
import { EXAMPLE_RULES } from './{name}.constants';

// ============================================
// 공통 스키마 (재사용)
// ============================================

/** 이메일 스키마 */
export const emailSchema = z
  .string()
  .email('올바른 이메일 형식이 아닙니다')
  .max(255, '이메일은 255자 이내여야 합니다')
  .toLowerCase()
  .trim()
  .describe('사용자 이메일 주소');

// ============================================
// 요청 스키마
// ============================================

export const createExampleSchema = z
  .object({
    title: z
      .string()
      .min(1, '제목은 필수입니다')
      .max(200, '제목은 200자 이내')
      .describe('제목'),
    content: z
      .string()
      .max(5000, '내용은 5000자 이내')
      .optional()
      .describe('내용 (선택)'),
  })
  .describe('예시 생성 요청');

export type CreateExampleInput = z.infer<typeof createExampleSchema>;
```

### Validation 메시지 규칙

```typescript
// ✅ 한국어 에러 메시지
z.string().min(1, '제목은 필수입니다')
z.string().email('올바른 이메일 형식이 아닙니다')
z.literal(true, { message: '약관에 동의해주세요' })

// ❌ 영어 또는 메시지 생략
z.string().min(1)
z.string().email()
```

### Refine 사용법

```typescript
// 비밀번호 확인 검증
export const registerSchema = z
  .object({
    password: passwordSchema,
    passwordConfirm: z.string().describe('비밀번호 확인'),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: '비밀번호가 일치하지 않습니다',
    path: ['passwordConfirm'], // 에러 위치 지정
  })
  .describe('회원가입 요청');
```

### Nullable vs Optional

```typescript
// optional: 필드 자체가 없어도 됨
name: z.string().optional()  // undefined 허용

// nullable: null 값 허용
profileImage: z.string().nullable()  // null 허용

// 둘 다 허용
bio: z.string().optional().nullable()  // undefined, null 모두 허용
```

---

## Response 스키마 작성 규칙

```typescript
// domains/{name}/{name}.response.ts

import { z } from 'zod';

/** 예시 응답 스키마 */
export const exampleResponseSchema = z
  .object({
    id: z.string().cuid().describe('고유 ID'),
    title: z.string().describe('제목'),
    content: z.string().nullable().describe('내용'),
    createdAt: z.string().datetime().describe('생성일시'),
  })
  .describe('예시 응답');

export type ExampleResponse = z.infer<typeof exampleResponseSchema>;
```

---

## NestJS DTO 작성 규칙

### Request DTO

```typescript
// nestjs/domains/{name}/{name}.request.dto.ts

import { createZodDto } from 'nestjs-zod';
import {
  createExampleSchema,
  updateExampleSchema,
} from '../../../domains/{name}/{name}.request';

/** 예시 생성 요청 DTO */
export class CreateExampleDto extends createZodDto(createExampleSchema) {}

/** 예시 수정 요청 DTO */
export class UpdateExampleDto extends createZodDto(updateExampleSchema) {}
```

### Response DTO

```typescript
// nestjs/domains/{name}/{name}.response.dto.ts

import { createZodDto } from 'nestjs-zod';
import { exampleResponseSchema } from '../../../domains/{name}/{name}.response';

/** 예시 응답 DTO */
export class ExampleResponseDto extends createZodDto(exampleResponseSchema) {}
```

---

## Import 규칙

### 클라이언트에서 사용

```typescript
// 스키마 + 타입 import (검증 및 타입 사용)
import { 
  createTodoSchema,     // Zod 스키마 (클라이언트 검증용)
  CreateTodoInput,      // Request 타입
  TodoResponse,         // Response 타입
} from '@aido/validators';
```

### API 서버에서 사용

```typescript
// 타입만 필요할 때
import { CreateTodoInput, TodoResponse } from '@aido/validators';

// NestJS DTO 필요할 때 (Controller용)
import { CreateTodoDto, TodoResponseDto } from '@aido/validators/nestjs';
```

### 상수 import

```typescript
import { PASSWORD_RULES, DEVICE_TYPES } from '@aido/validators';
```

---

## Constants 작성 규칙

```typescript
// domains/{name}/{name}.constants.ts

/** 비밀번호 규칙 */
export const PASSWORD_RULES = {
  MIN_LENGTH: 8,
  MAX_LENGTH: 100,
  PATTERN: /^(?=.*[A-Za-z])(?=.*\d).+$/,
  ERROR_MESSAGE: '영문자 1개 이상, 숫자 1개 이상 포함 필수',
} as const;

/** 디바이스 타입 */
export const DEVICE_TYPES = ['IOS', 'ANDROID', 'WEB'] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];
```

---

## Export 구조

### 도메인 index.ts

```typescript
// domains/{name}/index.ts

export * from './{name}.constants';
export * from './{name}.request';
export * from './{name}.response';
```

### 메인 index.ts

```typescript
// index.ts

export * from './common';
export * from './domains/auth';
export * from './domains/todo';
```

### NestJS index.ts

```typescript
// nestjs/index.ts

export * from './domains/auth';
export * from './domains/todo';
```

---

## 새 도메인 추가 체크리스트

### 1. Zod 스키마 (필수)

- [ ] `domains/{name}/{name}.constants.ts` - 상수 정의
- [ ] `domains/{name}/{name}.request.ts` - Request 스키마
- [ ] `domains/{name}/{name}.response.ts` - Response 스키마
- [ ] `domains/{name}/index.ts` - 도메인 export
- [ ] `index.ts` - 메인에서 re-export

### 2. NestJS DTO (필수)

- [ ] `nestjs/domains/{name}/{name}.request.dto.ts` - Request DTO
- [ ] `nestjs/domains/{name}/{name}.response.dto.ts` - Response DTO
- [ ] `nestjs/domains/{name}/index.ts` - DTO export
- [ ] `nestjs/index.ts` - NestJS entrypoint에서 export

### 3. 빌드 확인

```bash
pnpm build
```

---

## 자주 사용하는 Zod 패턴

| 패턴 | 코드 |
|------|------|
| CUID ID | `z.string().cuid('유효하지 않은 ID입니다')` |
| ISO 날짜 | `z.string().datetime()` |
| Date 변환 | `z.coerce.date()` |
| Enum | `z.enum(['A', 'B'] as const)` |
| 배열 | `z.array(z.string()).min(1)` |
| URL | `z.string().url('올바른 URL이 아닙니다')` |
| 정규식 | `z.string().regex(/pattern/, '에러 메시지')` |

---

## 테스트

스키마 테스트는 `safeParse`를 사용:

```typescript
describe('createTodoSchema', () => {
  it('유효한 데이터를 통과시켜야 한다', () => {
    const result = createTodoSchema.safeParse({
      title: '테스트 제목',
      content: '테스트 내용',
    });
    expect(result.success).toBe(true);
  });

  it('제목이 없으면 실패해야 한다', () => {
    const result = createTodoSchema.safeParse({
      content: '내용만',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('title');
  });
});
```
