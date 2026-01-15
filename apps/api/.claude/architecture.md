# API 아키텍처 가이드

## 아키텍처 개요

```
HTTP Request
     ↓
┌─────────────────────────────────────────────────────────┐
│  Controller                                             │
│  - HTTP 요청/응답 처리                                  │
│  - DTO 검증 (Zod)                                       │
│  - Swagger 문서화                                       │
└─────────────────────────────────────────────────────────┘
     ↓
┌─────────────────────────────────────────────────────────┐
│  Service                                                │
│  - 비즈니스 로직                                        │
│  - 예외 처리 (NotFoundException 등)                     │
│  - 트랜잭션 관리                                        │
└─────────────────────────────────────────────────────────┘
     ↓
┌─────────────────────────────────────────────────────────┐
│  Repository                                             │
│  - 데이터 액세스                                        │
│  - Prisma 쿼리 실행                                     │
└─────────────────────────────────────────────────────────┘
     ↓
┌─────────────────────────────────────────────────────────┐
│  DatabaseService (Prisma)                               │
│  - PostgreSQL 연결                                      │
└─────────────────────────────────────────────────────────┘
```

---

## Controller 계층

**역할**: HTTP 요청 처리, 입력 검증, Swagger 문서화

### DO
- `@ApiTags`, `@ApiDoc`, `@ApiSuccessResponse` 데코레이터 사용
- DTO를 통한 입력 검증
- Service 메서드 호출 및 결과 반환

### DON'T
- 비즈니스 로직 포함
- 직접 Repository/Prisma 호출
- try-catch로 예외 처리 (GlobalExceptionFilter가 담당)

### 예시

```typescript
// src/modules/todo/todo.controller.ts

@ApiTags("todos")
@Controller("todos")
export class TodoController {
  constructor(
    private readonly todoService: TodoService,
    private readonly paginationService: PaginationService,
  ) {}

  @Get()
  @ApiDoc({ summary: "모든 Todo 조회 (오프셋 기반 페이지네이션)" })
  @ApiPaginatedResponse({ type: TodoResponseDto })
  findAll(@Query() query: PaginationDto) {
    const normalizedPagination = this.paginationService.normalizePagination(query);
    return this.todoService.findAllPaginated(normalizedPagination);
  }

  @Post()
  @ApiDoc({ summary: "Todo 생성" })
  @ApiCreatedResponse({ type: TodoResponseDto })
  create(@Body() dto: CreateTodoDto) {
    return this.todoService.create(userId, dto);
  }
}
```

---

## Service 계층

**역할**: 비즈니스 로직, 예외 처리, 데이터 변환

### DO
- Repository를 통한 데이터 액세스
- `NotFoundException`, `BadRequestException` 등 예외 발생
- 복잡한 비즈니스 규칙 구현

### DON'T
- 직접 Prisma 호출 (Repository 통해서만)
- HTTP 관련 코드 (`@Res()`, 상태코드 등)
- Controller 로직 포함

### 예시

```typescript
// src/modules/todo/todo.service.ts

@Injectable()
export class TodoService {
  constructor(
    private readonly todoRepository: TodoRepository,
    private readonly paginationService: PaginationService,
  ) {}

  async findById(id: string) {
    const todo = await this.todoRepository.findById(id);
    if (!todo) throw new NotFoundException(`Todo #${id} not found`);
    return todo;
  }

  async create(userId: string, dto: CreateTodoDto) {
    return this.todoRepository.create({
      userId,
      title: dto.title,
      content: dto.content,
      // ... 기타 필드
    });
  }

  async update(id: string, dto: UpdateTodoDto) {
    await this.findById(id); // 존재 여부 확인
    return this.todoRepository.update(id, dto);
  }
}
```

---

## Repository 계층

**역할**: 데이터 액세스, Prisma 쿼리 캡슐화

### DO
- `DatabaseService` 주입하여 Prisma 사용
- 타입이 명확한 반환값 (`Promise<Todo>`, `Promise<Todo | null>`)
- 페이지네이션 쿼리 구현

### DON'T
- 예외 발생 (Service에서 담당)
- 비즈니스 로직 포함
- 다른 Repository 직접 호출

### 예시

```typescript
// src/modules/todo/todo.repository.ts

@Injectable()
export class TodoRepository {
  constructor(private readonly database: DatabaseService) {}

  async findById(id: string): Promise<Todo | null> {
    return this.database.todo.findUnique({ where: { id } });
  }

  async create(data: Prisma.TodoUncheckedCreateInput): Promise<Todo> {
    return this.database.todo.create({ data });
  }

  async findAllWithPagination(params: { skip: number; take: number }) {
    const [items, total] = await this.database.$transaction([
      this.database.todo.findMany({
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: "desc" },
      }),
      this.database.todo.count(),
    ]);
    return { items, total };
  }
}
```

---

## DTO 구조

### 스키마 관리: `@aido/validators` 패키지

Zod 스키마는 **`@aido/validators`** 워크스페이스 패키지에서 중앙 관리합니다.

```
packages/validators/src/
├── domains/
│   └── todo/
│       ├── todo.schema.ts    # 엔티티 스키마 (응답용)
│       └── todo.dto.ts       # Request DTO 스키마 (create, update)
├── common/
│   ├── datetime.ts           # 날짜 스키마
│   └── query.ts              # 페이지네이션 스키마
└── index.ts                  # 모든 스키마/타입 re-export
```

### 스키마 정의 (`@aido/validators`)

```typescript
// packages/validators/src/domains/todo/todo.dto.ts

import { z } from 'zod';

export const todoCreateSchema = z.object({
  title: z.string().min(1, '제목은 필수입니다').max(200, '제목은 200자 이내'),
  content: z.string().max(5000).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#4A90E2'),
  startDate: dateInputSchema.default(() => new Date()),
  endDate: optionalDateInputSchema,
  isAllDay: z.boolean().default(true),
  visibility: todoVisibilitySchema.default('PUBLIC'),
});

export type TodoCreate = z.infer<typeof todoCreateSchema>;
```

### API에서 DTO 클래스 생성

```typescript
// apps/api/src/modules/todo/dtos/request/create-todo.dto.ts

import { todoCreateSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

// 스키마 re-export (Swagger용)
export { todoCreateSchema as CreateTodoSchema } from "@aido/validators";

// NestJS DTO 클래스 생성
export class CreateTodoDto extends createZodDto(todoCreateSchema) {}
```

### 파일 구조

```
apps/api/src/modules/todo/
├── dtos/
│   ├── request/
│   │   ├── create-todo.dto.ts   # todoCreateSchema → CreateTodoDto
│   │   ├── update-todo.dto.ts   # todoUpdateSchema → UpdateTodoDto
│   │   └── index.ts
│   └── response/
│       ├── todo-response.dto.ts
│       └── index.ts
```

### 스키마 추가 시 작업 순서

1. `packages/validators/src/domains/{name}/{name}.dto.ts`에 스키마 정의
2. `packages/validators/src/domains/{name}/index.ts`에서 export
3. `packages/validators/src/index.ts`에서 re-export
4. `apps/api/src/modules/{name}/dtos/request/`에서 `createZodDto()` 사용

---

## Module 구성

```typescript
// src/modules/todo/todo.module.ts

@Module({
  controllers: [TodoController],
  providers: [TodoService, TodoRepository],
  exports: [TodoService], // 다른 모듈에서 사용 시
})
export class TodoModule {}
```

### 의존성 주입 규칙

- Controller → Service (직접 주입)
- Service → Repository (직접 주입)
- Repository → DatabaseService (공통 모듈에서 제공)

---

## 공통 모듈

### PaginationService

```typescript
// 오프셋 기반 페이지네이션
const params = this.paginationService.normalizePagination({ page: 1, size: 20 });
// → { page: 1, size: 20, skip: 0, take: 20 }

// 커서 기반 페이지네이션
const cursorParams = this.paginationService.normalizeCursorPagination({ cursor, size: 20 });
```

### ResponseTransformInterceptor

모든 성공 응답을 자동으로 래핑:

```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### GlobalExceptionFilter

모든 에러 응답을 자동으로 래핑:

```json
{
  "success": false,
  "error": {
    "code": "TODO_NOT_FOUND",
    "message": "Todo #123 not found"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## 새 모듈 추가 체크리스트

새 도메인 모듈 추가 시 아래 순서로 작업:

### 1. `@aido/validators` 패키지 (스키마 먼저)

- [ ] `packages/validators/src/domains/{name}/{name}.schema.ts` - 엔티티 스키마
- [ ] `packages/validators/src/domains/{name}/{name}.dto.ts` - Request DTO 스키마
- [ ] `packages/validators/src/domains/{name}/index.ts` - 도메인 export
- [ ] `packages/validators/src/index.ts` - 패키지 re-export
- [ ] `pnpm build` 실행 (워크스페이스 패키지 빌드)

### 2. Prisma 스키마

- [ ] `apps/api/prisma/schema.prisma` - 모델 추가
- [ ] `pnpm --filter @aido/api prisma:migrate` - 마이그레이션 생성

### 3. `apps/api` 모듈

- [ ] `src/modules/{name}/{name}.module.ts` 생성
- [ ] `src/modules/{name}/{name}.controller.ts` 생성
- [ ] `src/modules/{name}/{name}.service.ts` 생성
- [ ] `src/modules/{name}/{name}.repository.ts` 생성
- [ ] `src/modules/{name}/dtos/request/*.dto.ts` - `createZodDto()` 사용
- [ ] `src/modules/{name}/dtos/response/*.dto.ts` 생성
- [ ] `src/app.module.ts`에 모듈 import 추가
