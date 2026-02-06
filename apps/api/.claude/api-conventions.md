# API 코드 규칙

> Controller, Service, Repository 계층별 규칙 및 패턴

## 관련 문서

| 문서 | 설명 |
|------|------|
| [architecture.md](./architecture.md) | 전체 아키텍처 개요 |
| [validators.md](./validators.md) | @aido/validators 패키지 규칙 |
| [prisma.md](./prisma.md) | Prisma 7 가이드 |
| [unit-test.md](./unit-test.md) | 단위 테스트 가이드 |
| [e2e-test.md](./e2e-test.md) | E2E 테스트 가이드 |

---

## 개요

| 항목 | 규칙 |
|------|------|
| Controller | HTTP 요청/응답만 처리, 비즈니스 로직 금지 |
| Service | 비즈니스 로직 담당, Repository 통해 데이터 접근 |
| Repository | 데이터 액세스만 담당, 예외 발생 금지 |
| Module | 의존성 주입 및 모듈 경계 정의 |

---

## 디렉토리 구조

```
src/modules/{name}/
├── {name}.module.ts           # 모듈 정의
├── {name}.controller.ts       # HTTP 엔드포인트
├── services/
│   ├── {name}.service.ts      # 비즈니스 로직
│   └── index.ts
├── repositories/
│   ├── {name}.repository.ts   # 데이터 액세스
│   └── index.ts
├── types/
│   ├── {name}.types.ts        # 타입 정의
│   └── index.ts
├── constants/
│   ├── {name}.constants.ts    # 모듈 상수
│   └── index.ts
├── guards/                    # 인증/권한 가드
├── decorators/                # 커스텀 데코레이터
└── strategies/                # Passport 전략
```

---

## Controller 규칙

### 파일 위치

```
src/modules/{name}/{name}.controller.ts
```

### 기본 구조

```typescript
import { Controller, Get, Post, Body, Param, Query, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ApiDoc, ApiSuccessResponse, ApiCreatedResponse } from '@common/swagger';
import { ExampleDto, ExampleResponseDto } from '@aido/validators/nestjs';

@ApiTags('examples')
@Controller('examples')
export class ExampleController {
  constructor(private readonly exampleService: ExampleService) {}

  @Get()
  @ApiDoc({ 
    summary: '목록 조회',
    description: `
## 📋 예시 목록 조회

페이지네이션된 예시 목록을 조회합니다.

### 📝 쿼리 파라미터
- \`page\`: 페이지 번호 (기본값: 1)
- \`size\`: 페이지 크기 (기본값: 20, 최대: 100)
    `,
  })
  @ApiSuccessResponse({ type: ExampleResponseDto, isArray: true })
  async findAll(@Query() query: PaginationDto) {
    return this.exampleService.findAll(query);
  }
}
```

### 필수 데코레이터

| 데코레이터 | 용도 | 필수 여부 |
|-----------|------|----------|
| `@ApiTags()` | Swagger 그룹 | 필수 |
| `@Controller()` | 라우트 경로 | 필수 |
| `@ApiDoc()` | 엔드포인트 문서 | 필수 |
| `@ApiBearerAuth()` | 인증 필요 표시 | 인증 필요시 |
| `@ApiSuccessResponse()` | 성공 응답 타입 | 필수 |

### Swagger description 작성법

마크다운 형식으로 상세 설명:

```typescript
@ApiDoc({
  summary: '짧은 요약 (50자 이내)',
  description: `
## 🎯 기능 제목

기능에 대한 상세 설명

### 🔐 인증 요구사항
\`Authorization: Bearer {accessToken}\`

### 📝 요청 필드
- \`field1\`: 설명 (필수/선택)
- \`field2\`: 설명

### ⚠️ 주의사항
- 주의할 점 1
- 주의할 점 2

### 🚫 에러 케이스
- \`ERROR_CODE\`: 에러 상황 설명
  `,
})
```

### Request 메타데이터 추출

```typescript
private extractMetadata(req: Request): SessionMetadata {
  return {
    ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
    deviceName: req.body?.deviceName,
    deviceType: req.body?.deviceType,
  };
}
```

### DO ✅

- Service 메서드 호출 및 결과 반환
- Request 메타데이터 추출 (IP, User-Agent)
- DTO를 통한 입력 검증
- Swagger 문서화

### DON'T ❌

- 비즈니스 로직 포함
- 직접 Repository/Prisma 호출
- try-catch 예외 처리 (GlobalExceptionFilter가 담당)
- 응답 형식 직접 변환 (ResponseTransformInterceptor가 담당)

---

## Service 규칙

### 파일 위치

```
src/modules/{name}/services/{name}.service.ts
```

### 기본 구조

```typescript
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ExampleRepository } from '../repositories';
import type { CreateExampleInput, ExampleResponse } from '@aido/validators';

@Injectable()
export class ExampleService {
  private readonly logger = new Logger(ExampleService.name);

  constructor(
    private readonly exampleRepository: ExampleRepository,
    private readonly database: DatabaseService, // 트랜잭션용
  ) {}

  /**
   * ID로 예시 조회
   * @throws NotFoundException 존재하지 않는 경우
   */
  async findById(id: string): Promise<ExampleResponse> {
    const example = await this.exampleRepository.findById(id);
    if (!example) {
      throw new NotFoundException(`Example #${id} not found`);
    }
    return example;
  }

  /**
   * 예시 생성
   */
  async create(input: CreateExampleInput): Promise<ExampleResponse> {
    const example = await this.exampleRepository.create(input);
    this.logger.log(`Example created: ${example.id}`);
    return example;
  }
}
```

### 의존성 주입 규칙

```typescript
// DO: Repository 주입
constructor(
  private readonly userRepository: UserRepository,
  private readonly profileRepository: ProfileRepository,
) {}

// DON'T: DatabaseService 직접 사용 (Repository 통해서만)
constructor(
  private readonly database: DatabaseService, // 트랜잭션용으로만 허용
) {}
```

### 트랜잭션 사용

다중 테이블 작업 시 반드시 트랜잭션 사용:

```typescript
async createWithProfile(input: CreateUserInput): Promise<User> {
  return this.database.$transaction(async (tx) => {
    const user = await this.userRepository.create(input, tx);
    await this.profileRepository.create({ userId: user.id }, tx);
    await this.accountRepository.createCredentialAccount(user.id, hashedPassword, tx);
    return user;
  });
}
```

### 결과 타입 정의

```typescript
// types/{name}.types.ts

export interface LoginResult {
  userId: string;
  tokens: TokenPair;
  sessionId: string;
  name: string | null;
  profileImage: string | null;
}

export interface CreateExampleResult {
  id: string;
  message: string;
}
```

### 로깅 규칙

```typescript
// 중요한 비즈니스 이벤트만 로깅
this.logger.log(`User registered: ${user.id}`);
this.logger.log(`Password changed for user: ${userId}`);
this.logger.warn(`Login attempt failed for: ${email}`);
this.logger.error(`Payment failed for order: ${orderId}`, error.stack);
```

### DO ✅

- Repository를 통한 데이터 액세스
- `NotFoundException`, `BadRequestException` 등 예외 발생
- Logger 사용한 중요 작업 로깅
- 비즈니스 로직 구현
- 입력 데이터 검증/변환

### DON'T ❌

- Repository 거치지 않고 직접 Prisma 호출
- HTTP 관련 코드 (`@Res()`, 상태코드 설정)
- Controller 로직 포함 (요청 파싱 등)
- 무분별한 로깅 (성능 저하)

---

## Repository 규칙

### 파일 위치

```
src/modules/{name}/repositories/{name}.repository.ts
```

### 기본 구조

```typescript
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '@common/database';

@Injectable()
export class ExampleRepository {
  constructor(private readonly database: DatabaseService) {}

  async findById(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Example | null> {
    const client = tx ?? this.database;
    return client.example.findUnique({ where: { id } });
  }

  async create(
    data: Prisma.ExampleUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Example> {
    const client = tx ?? this.database;
    return client.example.create({ data });
  }

  async update(
    id: string,
    data: Prisma.ExampleUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Example> {
    const client = tx ?? this.database;
    return client.example.update({ where: { id }, data });
  }

  async delete(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.database;
    await client.example.delete({ where: { id } });
  }
}
```

### 트랜잭션 클라이언트 패턴

모든 메서드에 옵셔널 트랜잭션 클라이언트 지원:

```typescript
async someMethod(
  param: string,
  tx?: Prisma.TransactionClient,  // 항상 마지막 파라미터
): Promise<Result> {
  const client = tx ?? this.database;  // 트랜잭션 또는 기본 클라이언트
  return client.model.findUnique({ ... });
}
```

### 복잡한 쿼리

```typescript
async findAllWithPagination(params: {
  skip: number;
  take: number;
  where?: Prisma.ExampleWhereInput;
}) {
  const [items, total] = await this.database.$transaction([
    this.database.example.findMany({
      skip: params.skip,
      take: params.take,
      where: params.where,
      orderBy: { createdAt: 'desc' },
    }),
    this.database.example.count({ where: params.where }),
  ]);
  return { items, total };
}
```

### 관계 포함 조회

```typescript
async findByIdWithProfile(id: string): Promise<UserWithProfile | null> {
  return this.database.user.findUnique({
    where: { id },
    include: {
      profile: true,
      accounts: { select: { provider: true } },
    },
  });
}
```

### DO ✅

- DatabaseService 주입하여 Prisma 사용
- 타입이 명확한 반환값 정의
- 단일 엔티티 책임 (User → UserRepository)
- 트랜잭션 클라이언트 지원

### DON'T ❌

- 예외 발생 (Service에서 담당)
- 비즈니스 로직 포함
- 다른 Repository 직접 호출
- 데이터 변환 로직 포함

---

## Module 구성

### 파일 위치

```
src/modules/{name}/{name}.module.ts
```

### 기본 구조

```typescript
import { Module } from '@nestjs/common';
import { ExampleController } from './example.controller';
import { ExampleService } from './services';
import { ExampleRepository } from './repositories';

@Module({
  controllers: [ExampleController],
  providers: [
    ExampleService,
    ExampleRepository,
  ],
  exports: [ExampleService], // 다른 모듈에서 사용 시
})
export class ExampleModule {}
```

### 다른 모듈 의존성

```typescript
import { Module } from '@nestjs/common';
import { EmailModule } from '../email';

@Module({
  imports: [EmailModule], // EmailService 사용 가능
  controllers: [AuthController],
  providers: [AuthService, UserRepository],
})
export class AuthModule {}
```

---

## AI 모듈 패턴

### AI 파싱 → Todo 생성 플로우

```
┌─────────────────────────────────────────────────────────────────┐
│                    클라이언트 통합 플로우                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 사용자 입력        2. AI 파싱           3. 사용자 확인       │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐     │
│  │ "내일 3시에  │ ───► │ POST        │ ───► │ 파싱 결과   │     │
│  │  회의하기"   │      │ /v1/ai/     │      │ 미리보기    │     │
│  └─────────────┘      │ parse-todo  │      └─────────────┘     │
│                       └─────────────┘             │             │
│                                                   ▼             │
│  4. Todo 생성         5. 저장 완료                              │
│  ┌─────────────┐      ┌─────────────┐                          │
│  │ POST        │ ───► │ Todo 생성   │                          │
│  │ /v1/todos   │      │ 완료!       │                          │
│  └─────────────┘      └─────────────┘                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 패턴 선택 이유

| 이유 | 설명 |
|------|------|
| **사용자 확인** | AI 파싱 결과를 사용자가 검토/수정 가능 |
| **유연성** | 파싱만 사용하거나, 수동 생성도 가능 |
| **오류 복구** | 파싱 실패 시 사용자가 직접 수정 가능 |
| **업계 표준** | Gmail 스마트 컴포즈, Notion AI 등과 동일 |

### 클라이언트 구현 예시

```typescript
// 1단계: AI 파싱
const parseResult = await api.post('/v1/ai/parse-todo', { 
  text: '내일 오후 3시 회의' 
});

// 2단계: 사용자 확인 UI 표시
const confirmed = await showConfirmDialog(parseResult.data);

// 3단계: 확인 후 Todo 생성
if (confirmed) {
  await api.post('/v1/todos', parseResult.data);
}
```

### AI 사용량 제한

| 플랜 | 일일 제한 |
|------|----------|
| FREE | 5회 |
| PREMIUM | 100회 |

---

## 소셜 모듈 패턴

### Follow 관계

```typescript
// 팔로우
POST /v1/follows/:userId

// 언팔로우
DELETE /v1/follows/:userId

// 내 팔로워 목록
GET /v1/follows/followers

// 내가 팔로우하는 목록
GET /v1/follows/following
```

### Cheer/Nudge 전송

```typescript
// 응원 전송 (팔로잉 대상에게만)
POST /v1/cheers
{
  "receiverId": "cuid",
  "message": "화이팅!"  // Cheer만 메시지 포함
}

// 찌르기 전송 (팔로잉 대상에게만)
POST /v1/nudges
{
  "receiverId": "cuid"
}
```

### 권한 검증 패턴

모든 소셜 기능은 팔로우 관계를 먼저 확인:

```typescript
// Service 내부 로직
async sendCheer(senderId: string, receiverId: string) {
  // 1. 팔로우 관계 확인
  const isFollowing = await this.followRepository.isFollowing(senderId, receiverId);
  if (!isFollowing) {
    throw new ForbiddenException('팔로우한 사용자에게만 응원을 보낼 수 있습니다');
  }
  
  // 2. 응원 생성
  return this.cheerRepository.create({ senderId, receiverId, ... });
}
```

---

## 응답 형식

### 성공 응답 (자동 래핑)

`ResponseTransformInterceptor`가 자동으로 래핑:

```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-02-06T10:30:00.000Z"
}
```

### 에러 응답 (자동 래핑)

`GlobalExceptionFilter`가 자동으로 래핑:

```json
{
  "success": false,
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "사용자를 찾을 수 없습니다"
  },
  "timestamp": "2026-02-06T10:30:00.000Z"
}
```

### 페이지네이션 응답

```json
{
  "success": true,
  "data": {
    "items": [...],
    "meta": {
      "page": 1,
      "size": 20,
      "total": 100,
      "totalPages": 5
    }
  },
  "timestamp": "2026-02-06T10:30:00.000Z"
}
```

---

## 예외 처리

### NestJS 내장 예외

```typescript
import { 
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';

// 404 Not Found
throw new NotFoundException('User not found');

// 400 Bad Request
throw new BadRequestException('Invalid input');

// 401 Unauthorized
throw new UnauthorizedException('Token expired');

// 403 Forbidden
throw new ForbiddenException('Access denied');

// 409 Conflict
throw new ConflictException('Email already exists');
```

### 커스텀 비즈니스 예외

```typescript
// common/exception/services/business-exception.service.ts

@Injectable()
export class BusinessException {
  // 이미 에러코드가 정의된 경우
  throw(errorInfo: ErrorInfo): never {
    throw new HttpException(
      { code: errorInfo.code, message: errorInfo.message },
      errorInfo.status,
    );
  }
}

// 사용
this.businessException.throw(AUTH_ERRORS.INVALID_CREDENTIALS);
```

---

## Import 별칭 (Path Aliases)

```typescript
// tsconfig.json paths 기반

// 공통 모듈
import { DatabaseService } from '@common/database';
import { ApiDoc, ApiSuccessResponse } from '@common/swagger';
import { BusinessException } from '@common/exception';

// 모듈 내부 (상대 경로)
import { UserRepository } from '../repositories';
import { AuthService } from './auth.service';

// validators 패키지
import { LoginInput, LoginResponse } from '@aido/validators';
import { LoginDto, LoginResponseDto } from '@aido/validators/nestjs';
```

---

## 개발 환경 설정

### Docker 실행 (필수)

API 개발 및 테스트를 위해 **반드시 Docker가 실행 중이어야** 합니다.

```bash
# PostgreSQL 컨테이너 시작 (프로젝트 루트에서)
pnpm docker:up

# 컨테이너 상태 확인
docker ps

# 컨테이너 중지
pnpm docker:down
```

> **주의**: Docker가 실행되지 않으면 데이터베이스 연결 실패로 API 서버가 시작되지 않습니다.

### 환경 변수 파일

| 파일 | 용도 | 설명 |
|------|------|------|
| `.env` | **프로덕션** | 실제 배포 환경 설정, Git에 **절대 커밋 금지** |
| `.env.development` | **개발** | 로컬 개발 환경 설정, Git에 커밋 가능 |
| `.env.example` | **템플릿** | 필요한 환경 변수 목록, 값은 예시 |
| `.env.test` | **테스트** | 테스트 환경 전용 설정 |

#### 환경 변수 로드 우선순위

1. `NODE_ENV=development` → `.env.development` 로드
2. `NODE_ENV=production` → `.env` 로드
3. `NODE_ENV=test` → `.env.test` 로드

#### 새 환경 변수 추가 시

```bash
# 1. .env.example에 변수 추가 (예시 값과 함께)
DATABASE_URL="postgresql://user:pass@localhost:5432/dbname"

# 2. .env.development에 실제 개발 값 추가
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/aido_dev"

# 3. ConfigService 스키마에 검증 추가 (필요시)
# src/common/config/schemas/에 스키마 정의
```

### 개발 서버 vs 프로덕션 서버

| 구분 | 개발 서버 | 프로덕션 서버 |
|------|----------|--------------|
| 명령어 | `pnpm dev` | `pnpm start:prod` |
| 환경 파일 | `.env.development` | `.env` |
| 특징 | Hot reload, 상세 로그 | 최적화, 최소 로그 |
| 데이터베이스 | 로컬 Docker PostgreSQL | 실제 DB 서버 |

```bash
# 개발 서버 시작 (apps/api에서)
pnpm dev

# 또는 프로젝트 루트에서 전체 개발 서버
pnpm dev

# 프로덕션 빌드 후 실행
pnpm build
pnpm start:prod
```

### 개발 시작 전 체크리스트

1. [ ] Docker Desktop 실행 확인
2. [ ] `pnpm docker:up`으로 PostgreSQL 컨테이너 시작
3. [ ] `.env.development` 파일 존재 확인
4. [ ] `pnpm prisma:migrate`로 DB 마이그레이션 적용
5. [ ] `pnpm dev`로 개발 서버 시작

---

## 새 모듈 추가 체크리스트

### 1. Prisma 스키마

- [ ] `prisma/schema.prisma`에 모델 추가
- [ ] `pnpm prisma:migrate` 실행

### 2. @aido/validators

- [ ] Request/Response 스키마 추가 ([validators.md](./validators.md) 참고)
- [ ] NestJS DTO 추가
- [ ] `pnpm build` 실행

### 3. API 모듈

- [ ] `repositories/{name}.repository.ts` 생성
- [ ] `services/{name}.service.ts` 생성
- [ ] `{name}.controller.ts` 생성
- [ ] `{name}.module.ts` 생성
- [ ] `types/{name}.types.ts` 생성 (필요시)

### 4. 등록

- [ ] `app.module.ts`에 모듈 import 추가

### 5. 테스트

- [ ] Repository 단위 테스트
- [ ] Service 단위 테스트
- [ ] E2E 테스트

---

## 타임존 처리 규칙

### 개요

서버는 **모든 날짜를 UTC**로 저장하며, 클라이언트가 `X-Timezone` 헤더로 사용자의 타임존을 전달한다.

| 항목 | 규칙 |
|------|------|
| 저장 | UTC (PostgreSQL TIMESTAMPTZ) |
| 전송 | ISO 8601 UTC (`2026-02-06T10:30:00.000Z`) |
| 날짜 경계 판단 | 클라이언트 `X-Timezone` 헤더 기준 |
| 기본값 | `X-Timezone` 미전송 시 `UTC` |

### X-Timezone 헤더

```
X-Timezone: Asia/Seoul
```

- IANA 타임존 식별자 사용 (예: `Asia/Seoul`, `America/New_York`)
- 날짜 경계 판단이 필요한 API에서만 사용
- 헤더가 없으면 `UTC`로 fallback

### @Timezone 데코레이터

```typescript
import { Timezone } from '@/common/decorators';

@Post()
async create(
  @Body() dto: CreateTodoDto,
  @Timezone() timezone: string,  // X-Timezone 헤더 값 추출
) {
  return this.service.create(dto, timezone);
}
```

### Swagger 문서화

`@Timezone()`을 사용하는 메서드에는 반드시 `@ApiHeader`를 추가:

```typescript
import { ApiHeader } from '@nestjs/swagger';

@ApiHeader({
  name: 'X-Timezone',
  required: false,
  description: '사용자 타임존 (IANA, 기본값: UTC)',
  example: 'Asia/Seoul',
})
@Post()
async create(@Timezone() timezone: string) { ... }
```

### 타임존이 필요한 API

| 모듈 | 엔드포인트 | 용도 |
|------|-----------|------|
| Todo | `POST /todos`, `PATCH /todos/:id`, `PATCH /todos/:id/complete`, `PATCH /todos/:id/schedule` | 날짜 경계 판단, 스케줄 시간 변환 |
| Cheer | `POST /cheers`, `GET /cheers/limit` | 일일 제한 리셋 기준 |
| Nudge | `POST /nudges`, `GET /nudges/limit` | 일일 제한 리셋 기준 |

### 날짜 유틸리티 (`@common/date`)

```typescript
import { getUserToday, toScheduledTime, startOfDayInTimezone } from '@common/date';

// 사용자의 "오늘" 시작 시각 (UTC)
const today = getUserToday(timezone);

// 사용자의 로컬 시간 → UTC 변환
const scheduledAt = toScheduledTime('2026-02-06', '14:00', timezone);

// 특정 시점의 타임존 기준 자정 (UTC)
const dayStart = startOfDayInTimezone(date, timezone);
```
