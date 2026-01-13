# Aido API

NestJS + Prisma 7 + PostgreSQL 백엔드

## 시작하기

```bash
# PostgreSQL 시작
pnpm docker:up

# DB 마이그레이션
pnpm prisma:migrate

# 개발 서버
pnpm dev
```

서버: `http://localhost:8080`
API 문서: `http://localhost:8080/api/docs`

## 주요 명령어

| 명령어                  | 설명                         |
| ----------------------- | ---------------------------- |
| `pnpm dev`              | 개발 서버 (watch)            |
| `pnpm build`            | 빌드                         |
| `pnpm test`             | 단위 테스트                  |
| `pnpm test:e2e`         | E2E 테스트                   |
| `pnpm test:integration` | 통합 테스트 (Testcontainers) |
| `pnpm prisma:studio`    | Prisma Studio                |

---

## 아키텍처

### 모듈 구조

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              AppModule                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                           Feature Modules                               │
│  ┌─────────────────┐  ┌─────────────────┐                               │
│  │   TodoModule    │  │  HealthModule   │                               │
│  │                 │  │                 │                               │
│  │  Controller     │  │  Controller     │                               │
│  │  Service        │  │  Indicators     │                               │
│  │  Repository     │  │                 │                               │
│  │  DTOs           │  │                 │                               │
│  └─────────────────┘  └─────────────────┘                               │
├─────────────────────────────────────────────────────────────────────────┤
│                           Common Modules                                │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │  Exception   │ │   Response   │ │  Pagination  │ │    Logger    │   │
│  │              │ │              │ │              │ │              │   │
│  │ ErrorCode    │ │ Interceptor  │ │ Service      │ │ PinoLogger   │   │
│  │ Exception    │ │ Interfaces   │ │ DTOs         │ │ Service      │   │
│  │ Filter       │ │              │ │ Interfaces   │ │              │   │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘   │
│  ┌──────────────┐                                                       │
│  │   Swagger    │                                                       │
│  │              │                                                       │
│  │ Decorators   │                                                       │
│  │ Schemas      │                                                       │
│  └──────────────┘                                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                           Database Module                               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     DatabaseModule (Global)                      │   │
│  │                                                                  │   │
│  │                      DatabaseService                             │   │
│  │                   (Prisma v7 + pg driver)                        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 레이어 책임

| 레이어     | 파일                | 책임                                 |
| ---------- | ------------------- | ------------------------------------ |
| Controller | `*.controller.ts`   | HTTP 요청/응답, Swagger 문서, 라우팅 |
| Service    | `*.service.ts`      | 비즈니스 로직, 예외 처리             |
| Repository | `*.repository.ts`   | 데이터 접근, Prisma 쿼리             |
| DTO        | `dtos/**/*.dto.ts`  | 요청/응답 스키마 (Zod 기반)          |

### 요청 흐름

```
HTTP Request
     │
     ▼
┌─────────────────┐
│   Controller    │ ◀── @Body() DTO (자동 Zod 검증)
│   - 라우팅      │
│   - Swagger     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Service      │ ◀── 비즈니스 로직
│   - 검증        │     BusinessException 예외 처리
│   - 트랜잭션    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Repository    │ ◀── DatabaseService (Prisma)
│   - CRUD        │     단순 데이터 접근
│   - 쿼리 빌드   │
└────────┬────────┘
         │
         ▼
    PostgreSQL
```

---

## 프로젝트 구조

```
src/
├── main.ts                    # 앱 엔트리포인트
├── app.module.ts              # 루트 모듈
├── app.controller.ts          # 루트 컨트롤러
├── app.service.ts             # 루트 서비스
│
├── common/                    # 공통 모듈
│   ├── exception/             # 예외 처리
│   │   ├── constants/
│   │   │   └── error.constant.ts      # ErrorCode as const + 메시지
│   │   ├── filters/
│   │   │   └── global-exception.filter.ts
│   │   ├── interfaces/
│   │   │   └── error.interface.ts
│   │   ├── services/
│   │   │   └── business-exception.service.ts
│   │   ├── exception.module.ts
│   │   └── index.ts
│   │
│   ├── response/              # 응답 처리
│   │   ├── interceptors/
│   │   │   └── response-transform.interceptor.ts
│   │   ├── interfaces/
│   │   │   └── response.interface.ts
│   │   ├── response.module.ts
│   │   └── index.ts
│   │
│   ├── pagination/            # 페이지네이션
│   │   ├── constants/
│   │   │   └── pagination.constant.ts
│   │   ├── dtos/
│   │   │   ├── cursor-pagination.dto.ts
│   │   │   └── pagination.dto.ts
│   │   ├── interfaces/
│   │   │   └── pagination.interface.ts
│   │   ├── services/
│   │   │   └── pagination.service.ts
│   │   ├── pagination.module.ts
│   │   └── index.ts
│   │
│   ├── logger/                # 로깅 (Pino)
│   │   ├── constants/
│   │   │   └── logger.constant.ts
│   │   ├── interfaces/
│   │   │   └── logger.interface.ts
│   │   ├── services/
│   │   │   └── logger.service.ts
│   │   ├── logger.module.ts
│   │   └── index.ts
│   │
│   ├── swagger/               # Swagger 커스텀 데코레이터
│   │   ├── constants/
│   │   │   └── swagger.constant.ts
│   │   ├── decorators/
│   │   │   ├── api-auth.decorator.ts
│   │   │   ├── api-error.decorator.ts
│   │   │   ├── api-operation.decorator.ts
│   │   │   └── api-response.decorator.ts
│   │   ├── interfaces/
│   │   │   └── swagger.interface.ts
│   │   ├── schemas/
│   │   │   └── response.schema.ts
│   │   └── index.ts
│   │
│   └── index.ts               # 메인 barrel export
│
├── config/                    # 환경 설정
├── generated/                 # Prisma 생성 코드
│
├── database/                  # Database 모듈 (Global)
│   ├── database.module.ts
│   ├── database.service.ts    # Prisma v7 + pg driver
│   └── index.ts
│
└── modules/                   # Feature 모듈
    ├── todo/
    │   ├── dtos/
    │   │   ├── request/
    │   │   │   ├── create-todo.dto.ts
    │   │   │   ├── update-todo.dto.ts
    │   │   │   └── index.ts
    │   │   └── response/
    │   │       ├── todo-response.dto.ts
    │   │       └── index.ts
    │   ├── todo.controller.ts
    │   ├── todo.service.ts
    │   ├── todo.repository.ts
    │   ├── todo.module.ts
    │   └── index.ts
    │
    └── health/
        ├── indicators/
        │   └── database.health.ts
        ├── health.controller.ts
        ├── health.module.ts
        └── index.ts

test/
├── e2e/                       # E2E 테스트
│   ├── app.e2e-spec.ts
│   ├── health.e2e-spec.ts
│   └── todo.e2e-spec.ts
├── integration/               # 통합 테스트
│   └── todo.integration-spec.ts
├── mocks/                     # 공유 Mock 객체
│   └── database.mock.ts
├── setup/                     # 테스트 헬퍼
│   └── test-database.ts       # Testcontainers 헬퍼
├── jest-e2e.json
├── jest-integration.json
├── setup-env.ts
└── tsconfig.json
```

---

## Common 모듈

### Exception 모듈

일관된 에러 응답을 위한 예외 처리 시스템입니다.

```typescript
// ErrorCode as const 사용 (enum 대신)
import { ERROR_CODE, ERROR_MESSAGE, BusinessException } from "@/common/exception";

// 사용 예시
throw new BusinessException(ERROR_CODE.USER_NOT_FOUND);
// → { code: "USER_NOT_FOUND", message: "사용자를 찾을 수 없습니다.", statusCode: 404 }

// 커스텀 메시지
throw new BusinessException(ERROR_CODE.INVALID_PARAMETER, "이메일 형식이 올바르지 않습니다.");
```

**에러 응답 형식:**

```json
{
  "success": false,
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "사용자를 찾을 수 없습니다.",
    "statusCode": 404,
    "timestamp": 1704067200000
  }
}
```

### Response 모듈

성공 응답을 자동으로 래핑하는 인터셉터입니다.

**성공 응답 형식:**

```json
{
  "success": true,
  "data": { ... },
  "timestamp": 1704067200000
}
```

### Pagination 모듈

오프셋 기반과 커서 기반 페이지네이션을 모두 지원합니다.

```typescript
import { PaginationService, PaginationDto, CursorPaginationDto } from "@/common/pagination";

// 오프셋 기반: GET /todos?page=1&size=20
// 커서 기반: GET /todos/cursor?cursor=25&size=20
```

**페이지네이션 응답:**

```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "size": 20,
      "total": 100,
      "totalPages": 5,
      "hasNext": true,
      "hasPrevious": false
    }
  },
  "timestamp": 1704067200000
}
```

### Logger 모듈

Pino Logger를 래핑한 서비스입니다.

```typescript
import { LoggerService } from "@/common/logger";

@Injectable()
export class SomeService {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext("SomeService");
  }

  doSomething() {
    this.logger.log("작업 시작", { userId: 123 });
  }
}
```

### Swagger 모듈

반복적인 Swagger 문서화를 간소화하는 커스텀 데코레이터입니다.

```typescript
import {
  ApiDoc,
  ApiSuccessResponse,
  ApiPaginatedResponse,
  ApiErrorResponse,
  ApiAuthRequired,
} from "@/common/swagger";

@Get(":id")
@ApiDoc({ summary: "Todo 상세 조회" })  // 400, 500 에러 자동 포함
@ApiSuccessResponse({ type: TodoResponseDto })
@ApiErrorResponse({ errorCode: "USER_NOT_FOUND" })  // 404 + 메시지 자동
findById(@Param("id", ParseIntPipe) id: number) { ... }

@Get()
@ApiDoc({ summary: "Todo 목록 조회" })
@ApiPaginatedResponse({ type: TodoResponseDto })  // 페이지네이션 응답 자동
findAll(@Query() pagination: PaginationDto) { ... }

@Post()
@ApiAuthRequired()  // Bearer 인증 + 401 응답 자동
@ApiDoc({ summary: "Todo 생성" })
create(@Body() dto: CreateTodoDto) { ... }
```

---

## 코드 패턴

### 1. Feature Module 생성

새 도메인(예: `user`)을 추가할 때:

```
src/modules/user/
├── dtos/
│   ├── request/
│   │   ├── create-user.dto.ts
│   │   ├── update-user.dto.ts
│   │   └── index.ts
│   └── response/
│       ├── user-response.dto.ts
│       └── index.ts
├── user.controller.ts
├── user.service.ts
├── user.repository.ts
├── user.module.ts
└── index.ts
```

### 2. DTO 작성 (@aido/validators 연동)

`@aido/validators`의 Zod 스키마를 재사용하여 DTO를 생성합니다:

```typescript
// src/modules/user/dtos/request/create-user.dto.ts
import { userCreateSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class CreateUserDto extends createZodDto(userCreateSchema) {}
```

**장점:**

- 프론트엔드와 동일한 검증 규칙 공유
- 런타임 검증 + TypeScript 타입 자동 추출
- Swagger 문서 자동 생성

### 3. Controller 패턴

```typescript
import { ApiDoc, ApiSuccessResponse, ApiErrorResponse } from "@/common/swagger";
import { ERROR_CODE } from "@/common/exception";

@ApiTags("users")
@Controller("users")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(":id")
  @ApiDoc({ summary: "User 상세 조회" })
  @ApiParam({ name: "id", type: Number })
  @ApiSuccessResponse({ type: UserResponseDto })
  @ApiErrorResponse({ errorCode: ERROR_CODE.USER_NOT_FOUND })
  findById(@Param("id", ParseIntPipe) id: number) {
    return this.userService.findById(id);
  }

  @Post()
  @ApiDoc({ summary: "User 생성" })
  @ApiSuccessResponse({ type: UserResponseDto, status: 201 })
  create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }
}
```

### 4. Service 패턴

```typescript
import { BusinessException, ERROR_CODE } from "@/common/exception";

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async findById(id: number) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new BusinessException(ERROR_CODE.USER_NOT_FOUND);
    }
    return user;
  }

  async create(dto: CreateUserDto) {
    const existing = await this.userRepository.findByEmail(dto.email);
    if (existing) {
      throw new BusinessException(ERROR_CODE.EMAIL_ALREADY_EXISTS);
    }
    return this.userRepository.create(dto);
  }
}
```

### 5. Repository 패턴

```typescript
import { DatabaseService } from "@/database";

@Injectable()
export class UserRepository {
  constructor(private readonly db: DatabaseService) {}

  async findAll() {
    return this.db.user.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(id: number) {
    return this.db.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string) {
    return this.db.user.findUnique({ where: { email } });
  }

  async create(data: { name: string; email: string }) {
    return this.db.user.create({ data });
  }

  async update(id: number, data: Partial<User>) {
    return this.db.user.update({ where: { id }, data });
  }

  async delete(id: number) {
    return this.db.user.delete({ where: { id } });
  }
}
```

---

## 테스트 전략

### 테스트 구조

| 종류   | 위치                   | 파일 패턴               | 설명                            |
| ------ | ---------------------- | ----------------------- | ------------------------------- |
| 단위   | `src/**/__tests__/`    | `*.spec.ts`             | Mock 사용, 빠른 피드백          |
| 통합   | `test/integration/`    | `*.integration-spec.ts` | Testcontainers로 실제 DB 테스트 |
| E2E    | `test/e2e/`            | `*.e2e-spec.ts`         | HTTP API 전체 흐름 테스트       |

### 테스트 피라미드

```
        ┌───────┐
        │  E2E  │  ← 적은 수, 전체 흐름 검증
       ─┴───────┴─
      ┌───────────┐
      │ 통합 테스트 │ ← 실제 DB, 중요 시나리오
     ─┴───────────┴─
    ┌───────────────┐
    │   단위 테스트   │ ← 많은 수, Mock, 빠른 실행
    └───────────────┘
```

### 테스트 명령어

```bash
# 단위 테스트 (watch 모드)
pnpm test:watch

# 단위 테스트 (커버리지)
pnpm test:cov

# 통합 테스트 (Testcontainers)
pnpm test:integration

# E2E 테스트
pnpm test:e2e

# 전체 테스트
pnpm test:all

# 커밋 전 검증
pnpm typecheck && pnpm lint && pnpm test
```

### 테스트 헬퍼

**Testcontainers 사용 (test/setup/test-database.ts):**

```typescript
import { TestDatabase } from "../setup/test-database";

describe("Todo Integration", () => {
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = new TestDatabase();
    await testDb.start();  // PostgreSQL 컨테이너 시작 + 마이그레이션
  });

  afterAll(async () => {
    await testDb.stop();
  });

  beforeEach(async () => {
    await testDb.reset();  // 테스트 간 데이터 초기화
  });
});
```

---

## 환경 변수

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/aido"
NODE_ENV=development
PORT=8080
```

---

## 새 Feature 추가 체크리스트

1. [ ] `@aido/validators`에 Zod 스키마 추가
2. [ ] Prisma 스키마에 모델 추가 + 마이그레이션
3. [ ] `src/modules/` 아래에 Feature 모듈 생성
   - [ ] `dtos/request/` - 요청 DTO
   - [ ] `dtos/response/` - 응답 DTO
   - [ ] `*.controller.ts` - 컨트롤러
   - [ ] `*.service.ts` - 서비스
   - [ ] `*.repository.ts` - 레포지토리
   - [ ] `*.module.ts` - 모듈
   - [ ] `index.ts` - barrel export
4. [ ] DTO 작성 (`createZodDto` 사용)
5. [ ] Swagger 데코레이터 추가 (`@ApiDoc`, `@ApiSuccessResponse` 등)
6. [ ] `app.module.ts`에 import
7. [ ] 단위 테스트 작성 (`src/modules/*/__tests__/*.spec.ts`)
8. [ ] 통합 테스트 작성 (`test/integration/*.integration-spec.ts`)
9. [ ] E2E 테스트 작성 (`test/e2e/*.e2e-spec.ts`)
