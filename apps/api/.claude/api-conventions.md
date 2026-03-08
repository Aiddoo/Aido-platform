# API 코드 규칙

> Controller, Service, Repository, Module 계층별 코드 작성 규칙

## 관련 문서

| 문서 | 설명 |
|------|------|
| [CLAUDE.md](../CLAUDE.md) | API 앱 진입점 (기술 스택, 핵심 규칙, 문서 네비게이션) |
| [architecture.md](./architecture.md) | 전체 아키텍처, 에러 처리, 이벤트, 보안, 공통 모듈 |
| [validators.md](./validators.md) | @aido/validators 패키지 규칙 (Zod 스키마, NestJS DTO) |
| [prisma.md](./prisma.md) | Prisma 7 가이드 (스키마, 마이그레이션, 트랜잭션) |
| [unit-test.md](./unit-test.md) | 단위 테스트 가이드 (Jest, Mock) |
| [e2e-test.md](./e2e-test.md) | E2E 테스트 가이드 (supertest, Testcontainers) |

---

## 개요

| 계층 | 역할 | 핵심 규칙 |
|------|------|----------|
| Controller | HTTP 요청/응답 처리 | 비즈니스 로직 금지, Swagger 문서화 필수 |
| Service | 비즈니스 로직 | BusinessExceptions로 예외 발생, Repository 통해 데이터 접근 |
| Repository | 데이터 액세스 | 예외 발생 금지, 모든 메서드에 `tx?` 파라미터 |
| Module | 의존성 주입 | 모듈 경계 정의, `app.module.ts`에 등록 |

---

## 1. 디렉토리 구조

```
src/modules/{name}/
├── {name}.module.ts              # 모듈 정의
├── {name}.controller.ts          # HTTP 엔드포인트
├── services/
│   ├── {name}.service.ts         # 비즈니스 로직
│   └── index.ts
├── repositories/
│   ├── {name}.repository.ts      # 데이터 액세스
│   └── index.ts
├── types/
│   ├── {name}.types.ts           # 결과 타입 정의
│   └── index.ts
├── constants/
│   ├── {name}.constants.ts       # 모듈 상수
│   └── index.ts
├── mappers/                      # 응답 변환 (필요시)
│   └── {name}.mapper.ts
├── guards/                       # 인증/권한 가드 (필요시)
├── decorators/                   # 커스텀 데코레이터 (필요시)
└── strategies/                   # Passport 전략 (auth만)
```

---

## 2. Controller 규칙

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

### ⚠️ 주의사항
- 주의할 점

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
- Swagger 문서화 (`@ApiDoc`, `@ApiSuccessResponse`)
- `@Timezone()` 데코레이터로 타임존 추출 (필요시)

### DON'T ❌

- 비즈니스 로직 포함
- 직접 Repository/Prisma 호출
- try-catch 예외 처리 (GlobalExceptionFilter가 담당)
- 응답 형식 직접 변환 (ResponseTransformInterceptor가 담당)

---

## 3. Service 규칙

### 기본 구조

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { BusinessExceptions } from '@common/exception';
import { DatabaseService } from '@common/database';
import { [Feature]QueueService } from '../queue';
import { [Feature]Repository } from '../repositories';

@Injectable()
export class [Feature]Service {
  readonly #logger = new Logger([Feature]Service.name);

  constructor(
    private readonly [feature]Repository: [Feature]Repository,
    private readonly database: DatabaseService,  // 트랜잭션용
    private readonly [feature]QueueService: [Feature]QueueService, // 비동기 큐 (필요시)
  ) {}

  async findById(id: string) {
    const result = await this.[feature]Repository.findById(id);
    if (!result) {
      throw BusinessExceptions.[feature]NotFound(id);
    }
    return result;
  }

  async create(input: CreateInput) {
    const result = await this.[feature]Repository.create(input);
    this.#logger.log(`[Feature] created: ${result.id}`);

    // 부수효과는 QueueService로 비동기 위임 (fire-and-forget)
    this.[feature]QueueService.enqueueXxx({ ... });

    return result;
  }
}
```

### 의존성 주입 규칙

```typescript
// DO: Repository + DatabaseService(트랜잭션용) + QueueService(비동기 큐용)
constructor(
  private readonly [feature]Repository: [Feature]Repository,
  private readonly database: DatabaseService,
  private readonly [feature]QueueService: [Feature]QueueService,
) {}

// DO: 다른 Service 주입 (교차 모듈 로직)
constructor(
  private readonly followService: FollowService,
) {}

// DON'T: DatabaseService를 직접 쿼리에 사용 (Repository 통해야 함)
```

### 트랜잭션 사용

다중 테이블 작업 시 반드시 트랜잭션 사용:

```typescript
async createWithProfile(input: CreateUserInput) {
  return this.database.$transaction(async (tx) => {
    const user = await this.userRepository.create(input, tx);
    await this.profileRepository.create({ userId: user.id }, tx);
    await this.accountRepository.createCredentialAccount(user.id, hashedPassword, tx);
    return user;
  });
}
```

### 비동기 큐 enqueue

```typescript
async update(id: string, userId: string, data: UpdateInput) {
  const existing = await this.[feature]Repository.findByIdAndUserId(id, userId);
  if (!existing) throw BusinessExceptions.[feature]NotFound(id);

  const updated = await this.[feature]Repository.update(id, { ... });

  // 부수효과는 QueueService로 비동기 위임 (fire-and-forget)
  if (shouldNotify) {
    this.[feature]QueueService.enqueueXxx({
      userId,
      [feature]Id: updated.id,
    });
  }

  return updated;
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
```

### 로깅 규칙

```typescript
// 중요한 비즈니스 이벤트만 로깅
this.logger.log(`User registered: ${user.id}`);
this.logger.log(`Password changed for user: ${userId}`);
this.logger.warn(`Login attempt failed for: ${email}`);
this.logger.error(`Payment failed for order: ${orderId}`, error.stack);
```

> 상세 로깅 가이드: [logging-guide.md](./logging-guide.md)

### DO ✅

- `BusinessExceptions.xxx()` 팩토리 메서드로 예외 발생
- Repository를 통한 데이터 액세스
- `database.$transaction()`으로 트랜잭션 관리
- `[feature]QueueService.enqueueXxx()`로 비동기 부수효과 위임
- Logger 사용한 중요 작업 로깅
- 크론 작업에서 DB 기반 중복 방지

### DON'T ❌

- Repository 거치지 않고 직접 Prisma 호출
- HTTP 관련 코드 (`@Res()`, 상태코드 설정)
- Controller 로직 포함 (요청 파싱 등)
- `new HttpException()` 직접 사용 (BusinessExceptions 사용)
- 크론 작업에서 in-memory Set/Map으로 상태 관리 (서버 재시작 시 유실)

---

## 4. Repository 규칙

### 기본 구조

```typescript
import { Injectable } from '@nestjs/common';
import { DatabaseService, type TransactionClient } from '@common/database';

@Injectable()
export class [Feature]Repository {
  constructor(private readonly database: DatabaseService) {}

  async findById(
    id: string,
    tx?: TransactionClient,
  ): Promise<Example | null> {
    const client = tx ?? this.database;
    return client.example.findUnique({ where: { id } });
  }

  async create(
    data: Prisma.ExampleUncheckedCreateInput,
    tx?: TransactionClient,
  ): Promise<Example> {
    const client = tx ?? this.database;
    return client.example.create({ data });
  }

  async update(
    id: string,
    data: Prisma.ExampleUncheckedUpdateInput,
    tx?: TransactionClient,
  ): Promise<Example> {
    const client = tx ?? this.database;
    return client.example.update({ where: { id }, data });
  }

  async delete(
    id: string,
    tx?: TransactionClient,
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
  tx?: TransactionClient,  // 항상 마지막 파라미터
): Promise<Result> {
  const client = tx ?? this.database;  // 트랜잭션 또는 기본 클라이언트
  return client.model.findUnique({ ... });
}
```

### 복잡한 쿼리 (페이지네이션)

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

### 민감 데이터 암호화

OAuth 토큰 등 민감 데이터를 DB에 저장할 때 EncryptionService 사용:

```typescript
@Injectable()
export class AccountRepository {
  constructor(
    private readonly database: DatabaseService,
    private readonly encryptionService: EncryptionService,
  ) {}

  async createOAuthAccount(data: CreateOAuthData): Promise<Account> {
    return this.database.account.create({
      data: {
        ...data,
        accessToken: data.accessToken
          ? this.encryptionService.encrypt(data.accessToken) : null,
        refreshToken: data.refreshToken
          ? this.encryptionService.encrypt(data.refreshToken) : null,
      },
    });
  }
}
```

복호화 시 `decryptSafe()` 사용 (평문 fallback 지원):

```typescript
const token = this.encryptionService.decryptSafe(account.accessToken);
```

### DO ✅

- DatabaseService 주입하여 Prisma 사용
- 타입이 명확한 반환값 정의
- 단일 엔티티 책임 (User → UserRepository)
- 모든 메서드에 `tx?: Prisma.TransactionClient` 지원
- 민감 데이터는 EncryptionService로 암호화하여 저장

### DON'T ❌

- 예외 발생 (Service에서 담당)
- 비즈니스 로직 포함
- 다른 Repository 직접 호출
- 데이터 변환 로직 포함
- 민감 토큰을 평문으로 DB에 저장

---

## 5. Module 구성

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

> `@Global()` 모듈 (DatabaseModule, EncryptionModule, CacheModule 등)은 `imports` 없이 바로 주입 가능.

---

## 6. Import 별칭

```typescript
// @common/* — 공통 모듈 (tsconfig paths)
import { DatabaseService } from '@common/database';
import { ApiDoc, ApiSuccessResponse } from '@common/swagger';
import { BusinessExceptions } from '@common/exception';
import { PaginationService } from '@common/pagination';
import { EncryptionService } from '@common/encryption';
import { TypedConfigService } from '@common/config';
import { getUserToday, toScheduledTime } from '@common/date';
import { Timezone, CurrentUser } from '@common/decorators';

// @aido/validators — 공유 스키마 패키지
import { LoginInput, LoginResponse } from '@aido/validators';
import { LoginDto, LoginResponseDto } from '@aido/validators/nestjs';

// 모듈 내부 — 상대 경로
import { UserRepository } from '../repositories';
import { AuthService } from './auth.service';
```

---

## 7. 새 모듈 추가 체크리스트

### 1. Prisma 스키마

- [ ] `prisma/schema.prisma`에 모델 추가
- [ ] `pnpm prisma:migrate` 실행

### 2. @aido/validators

- [ ] Request/Response 스키마 추가 ([validators.md](./validators.md) 참고)
- [ ] NestJS DTO 추가
- [ ] `pnpm build` 실행

### 3. API 모듈

- [ ] `repositories/{name}.repository.ts` 생성 (tx 패턴 적용)
- [ ] `services/{name}.service.ts` 생성 (BusinessExceptions 사용)
- [ ] `{name}.controller.ts` 생성 (Swagger 문서화)
- [ ] `{name}.module.ts` 생성
- [ ] `types/{name}.types.ts` 생성 (필요시)

### 4. 등록

- [ ] `app.module.ts`에 모듈 import 추가

### 5. 에러 처리

- [ ] 필요한 BusinessExceptions 팩토리 메서드 추가
- [ ] 새 Unique Constraint가 있으면 constraintMap에 매핑 추가

### 6. 테스트

- [ ] Repository 단위 테스트
- [ ] Service 단위 테스트
- [ ] E2E 테스트

---

## 8. 개발 환경 설정

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

### 환경 변수 파일

| 파일 | 용도 | Git |
|------|------|-----|
| `.env` | 프로덕션 | 절대 커밋 금지 |
| `.env.development` | 개발 | 커밋 가능 |
| `.env.example` | 템플릿 | 커밋 가능 |
| `.env.test` | 테스트 | 커밋 가능 |

#### 환경 변수 로드 우선순위

1. `NODE_ENV=development` → `.env.development`
2. `NODE_ENV=production` → `.env`
3. `NODE_ENV=test` → `.env.test`

#### 새 환경 변수 추가 시

1. `.env.example`에 변수 추가 (예시 값)
2. `.env.development`에 실제 개발 값 추가
3. `src/common/config/schemas/`에 Zod 검증 스키마 추가

### 필수 환경변수

| 변수 | 설명 | 비고 |
|------|------|------|
| `TOKEN_ENCRYPTION_KEY` | AES-256-GCM 암호화 키 | 최소 32자 |
| `JWT_SECRET` | JWT 서명 키 | |
| `DATABASE_URL` | PostgreSQL 연결 문자열 | |

### 개발 시작 전 체크리스트

1. [ ] Docker Desktop 실행 확인
2. [ ] `pnpm docker:up`으로 PostgreSQL 컨테이너 시작
3. [ ] `.env.development` 파일 존재 확인
4. [ ] `pnpm prisma:migrate`로 DB 마이그레이션 적용
5. [ ] `pnpm dev`로 개발 서버 시작
