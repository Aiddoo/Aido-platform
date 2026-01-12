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

### Feature Module 구조

```
┌─────────────────────────────────────────────────────────────┐
│                        AppModule                            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ TodoModule  │  │HealthModule│  │    PrismaModule     │  │
│  │             │  │             │  │    (Global)         │  │
│  │ Controller  │  │ Controller  │  │                     │  │
│  │ Service     │  │ Service     │  │  PrismaService      │  │
│  │ Repository  │  │             │  │                     │  │
│  │ DTOs        │  │             │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 레이어 책임

| 레이어     | 파일              | 책임                                 |
| ---------- | ----------------- | ------------------------------------ |
| Controller | `*.controller.ts` | HTTP 요청/응답, Swagger 문서, 라우팅 |
| Service    | `*.service.ts`    | 비즈니스 로직, 예외 처리             |
| Repository | `*.repository.ts` | 데이터 접근, Prisma 쿼리             |
| DTO        | `dto/*.dto.ts`    | 요청/응답 스키마 (Zod 기반)          |

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
│   - 검증        │     NotFoundException 등 예외 처리
│   - 트랜잭션    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Repository    │ ◀── Prisma Client
│   - CRUD        │     단순 데이터 접근
│   - 쿼리 빌드   │
└────────┬────────┘
         │
         ▼
    PostgreSQL
```

---

## 코드 패턴

### 1. Feature Module 생성

새 도메인(예: `user`)을 추가할 때:

```
src/user/
├── user.module.ts       # 모듈 정의
├── user.controller.ts   # HTTP 엔드포인트
├── user.service.ts      # 비즈니스 로직
├── user.repository.ts   # 데이터 접근
└── dto/
    ├── create-user.dto.ts
    ├── update-user.dto.ts
    └── user-response.dto.ts
```

### 2. DTO 작성 (@aido/validators 연동)

`@aido/validators`의 Zod 스키마를 재사용하여 DTO를 생성합니다:

```typescript
// src/user/dto/create-user.dto.ts
import { userCreateSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

// 스키마는 @aido/validators에서 import
export { userCreateSchema as CreateUserSchema } from "@aido/validators";

// NestJS DTO 클래스 생성
export class CreateUserDto extends createZodDto(userCreateSchema) {}
```

**장점:**

- 프론트엔드와 동일한 검증 규칙 공유
- 런타임 검증 + TypeScript 타입 자동 추출
- Swagger 문서 자동 생성

### 3. Controller 패턴

```typescript
@ApiTags("users")
@Controller("users")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(":id")
  @ApiOperation({ summary: "User 상세 조회" })
  @ApiParam({ name: "id", type: Number })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiResponse({ status: 404, description: "User를 찾을 수 없음" })
  findById(@Param("id", ParseIntPipe) id: number) {
    return this.userService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: "User 생성" })
  @ApiResponse({ status: 201, type: UserResponseDto })
  @ApiResponse({ status: 400, description: "유효성 검증 실패" })
  create(@Body() dto: CreateUserDto) {
    // Zod 검증이 자동으로 적용됨
    return this.userService.create(dto);
  }
}
```

### 4. Service 패턴

```typescript
@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async findById(id: number) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }
    return user;
  }

  async create(dto: CreateUserDto) {
    // 비즈니스 검증 로직
    return this.userRepository.create(dto);
  }

  async update(id: number, dto: UpdateUserDto) {
    // 존재 여부 확인 (없으면 NotFoundException)
    await this.findById(id);
    return this.userRepository.update(id, dto);
  }
}
```

### 5. Repository 패턴

```typescript
@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<User[]> {
    return this.prisma.user.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async create(data: { name: string; email: string }): Promise<User> {
    return this.prisma.user.create({ data });
  }

  async update(id: number, data: Partial<User>): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  async delete(id: number): Promise<User> {
    return this.prisma.user.delete({ where: { id } });
  }
}
```

---

## 에러 핸들링

### 전역 예외 필터

모든 예외는 `GlobalExceptionFilter`를 통해 일관된 형식으로 응답됩니다.

**응답 형식:**

```json
{
  "statusCode": 404,
  "message": "Todo #123 not found",
  "error": "Not Found",
  "timestamp": "2025-01-13T00:00:00.000Z",
  "path": "/todos/123"
}
```

### 예외 사용 가이드

| 상황             | 예외                    | HTTP 코드 |
| ---------------- | ----------------------- | --------- |
| 리소스 없음      | `NotFoundException`     | 404       |
| 입력값 검증 실패 | `BadRequestException`   | 400       |
| 중복 데이터      | `ConflictException`     | 409       |
| 권한 없음        | `ForbiddenException`    | 403       |
| 인증 필요        | `UnauthorizedException` | 401       |

```typescript
// 사용 예시
if (!user) {
  throw new NotFoundException(`User #${id} not found`);
}

if (existingEmail) {
  throw new ConflictException("Email already exists");
}
```

---

## 테스트 전략

| 종류 | 파일명                  | 설명                            |
| ---- | ----------------------- | ------------------------------- |
| 단위 | `*.spec.ts`             | Mock 사용, 빠른 피드백          |
| 통합 | `*.integration-spec.ts` | Testcontainers로 실제 DB 테스트 |
| E2E  | `*.e2e-spec.ts`         | HTTP API 전체 흐름 테스트       |

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

### 개발 워크플로우

```bash
# 개발 중 (watch 모드)
pnpm test:watch

# 커밋 전 (전체 검증)
pnpm typecheck && pnpm lint && pnpm test

# CI/CD (통합 + E2E 포함)
pnpm test:integration && pnpm test:e2e
```

---

## 환경 변수

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/aido"
NODE_ENV=development
PORT=8080
```

---

## 프로젝트 구조

```
src/
├── main.ts              # 앱 엔트리포인트
├── app.module.ts        # 루트 모듈
├── app.controller.ts    # 루트 컨트롤러
├── app.service.ts       # 루트 서비스
│
├── common/              # 공통 모듈
│   └── filters/         # 예외 필터
│       └── http-exception.filter.ts
│
├── config/              # 환경 설정
├── generated/           # Prisma 생성 코드
├── health/              # 헬스체크 모듈
├── prisma/              # PrismaService
│
└── todo/                # Feature Module 예시
    ├── todo.module.ts
    ├── todo.controller.ts
    ├── todo.service.ts
    ├── todo.repository.ts
    └── dto/
        ├── create-todo.dto.ts
        ├── update-todo.dto.ts
        └── todo-response.dto.ts

test/
├── setup/               # Testcontainers 설정
├── *.e2e-spec.ts        # E2E 테스트
└── *.integration-spec.ts # 통합 테스트
```

---

## 새 Feature 추가 체크리스트

1. [ ] `@aido/validators`에 Zod 스키마 추가
2. [ ] Prisma 스키마에 모델 추가 + 마이그레이션
3. [ ] Feature 모듈 생성 (module, controller, service, repository)
4. [ ] DTO 작성 (`createZodDto` 사용)
5. [ ] Swagger 데코레이터 추가
6. [ ] 단위 테스트 작성 (`*.spec.ts`)
7. [ ] 통합 테스트 작성 (`*.integration-spec.ts`)
8. [ ] AppModule에 import
