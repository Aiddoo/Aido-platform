# API 코드 규칙

**Version**: 1.2.0 · **Last Updated**: 2026-07-12 · **Owner**: Aido Platform Team

> Controller, DTO/Swagger, Module 계층별 코드 작성 규칙
>
> ✅ **적용 범위**: **전 모듈이 클린아키텍처 use-case 표준**(참조 구현: todo)을 따른다 — 규칙은 **§9 클린아키텍처 모듈 규칙**이 정본이다. Controller/DTO/Swagger/Module 규칙(§2·§5~§8)은 공통. **§3 Service·§4 Repository는 이관 이전 3계층 패턴의 역사적 참고**이며 현재 이 패턴을 쓰는 모듈은 없다(2026-07 auth 이관 완료로 3계층 소멸).

## 관련 문서

| 문서 | 설명 |
|------|------|
| [AGENTS.md](../AGENTS.md) | API 앱 진입점 (기술 스택, 핵심 규칙, 문서 네비게이션) |
| [architecture.md](./architecture.md) | 전체 아키텍처, 에러 처리, 이벤트, 보안, 공통 모듈 |
| [validators.md](./validators.md) | @aido/validators 패키지 규칙 (Zod 스키마, NestJS DTO) |
| [prisma.md](./prisma.md) | Prisma 7 가이드 (스키마, 마이그레이션, 트랜잭션) |
| [unit-test.md](./unit-test.md) | 단위 테스트 가이드 (Jest, Mock) |
| [e2e-test.md](./e2e-test.md) | E2E 테스트 가이드 (supertest, Testcontainers) |

---

## 개요

| 계층 | 역할 | 핵심 규칙 |
|------|------|----------|
| Controller | HTTP 요청/응답 처리 | 비즈니스 로직 금지, Facade만 주입, Swagger 문서화 필수 |
| Facade | 유스케이스 조합 | 컨트롤러·크로스모듈의 유일한 주입 대상, 얇은 위임 |
| UseCase | 비즈니스 로직 | `@Injectable` 단일 `execute()`, `ApplicationException`/`DomainException` throw, 포트로 데이터 접근 |
| Port/Adapter | 외부 의존 추상화 | 포트=인터페이스+Symbol, 어댑터가 구현(Prisma·벤더·큐) |
| Repository | 데이터 액세스 | 포트 구현, CLS(`TransactionHost.tx`)에서 활성 TX 읽음 |
| Module | 의존성 주입 | 모듈 경계 정의, `app.module.ts`에 등록 |

> 상세 규칙은 **§9**. 아래 §1~§8은 공통(Controller/DTO/Swagger/Module) + 역사적 참고(§3·§4)다.

---

## 1. 디렉토리 구조

**전 모듈 표준 = 클린아키텍처 4계층** (참조 구현: todo). 상세는 **§9**.

```
src/{name}/
├── {name}.module.ts                 # DI 와이어링 (배럴 use-case 배열 등록)
├── index.ts                         # 공개 배럴 (Facade + DTO — 외부는 이것만 임포트)
├── domain/
│   ├── entities/{name}.entity.ts    # AggregateRoot (private ctor + reconstitute + planCreation)
│   ├── value-objects/*.vo.ts        # 값 객체 (불변식 = DomainException)
│   ├── events/*.event.ts            # 도메인 이벤트
│   └── services/*.ts                # 순수 도메인 정책
├── application/
│   ├── facades/{name}.facade.ts     # 컨트롤러의 유일 주입 대상
│   ├── ports/*.port.ts              # 인터페이스 + Symbol 토큰
│   ├── use-cases/<name>/<name>.use-case.ts   # 쓰기 (+ .spec)
│   └── queries/<name>/<name>.use-case.ts     # 읽기 (+ 캐싱)
├── infrastructure/
│   ├── adapters/*.adapter.ts        # 포트 구현 (벤더·큐)
│   ├── persistence/*.repository.ts  # Prisma 저장소 (포트 구현, CLS tx)
│   ├── guards/                      # 인증/권한 가드 (필요시)
│   ├── listeners/                   # @OnEvent 베스트에포트 리스너
│   └── strategies/                  # Passport 전략 (auth 한정)
└── presentation/
    ├── dtos/*.request.dto.ts / *.response.dto.ts
    └── {name}.controller.ts
```

---

## 2. Controller 규칙

> **Why**: 얇은 진입점. 비즈니스 로직 없이 DTO 검증 + Service 위임만 담당하여 변경 지점 최소화.

### 기본 구조

```typescript
import { Controller, Get, Post, Body, Param, Query, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ApiDoc, ApiSuccessResponse, ApiCreatedResponse } from '@/shared/presentation/swagger';

import { CurrentUser, type CurrentUserPayload } from '../auth/decorators';
import { ExampleResponseDto } from './dtos';

@ApiTags('examples')
@ApiBearerAuth()
@Controller('examples')
export class ExampleController {
  constructor(private readonly exampleService: ExampleService) {}

  @Get()
  @ApiDoc({
    summary: '목록 조회',
    operationId: 'findAllExamples',
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
    // Express trust proxy가 host-local Nginx 한 홉을 검증해 확정한 canonical IP
    ipAddress: req.ip || 'unknown',
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

> ⚠️ **역사적 참고 (현재 미사용)** — 이관 이전 3계층의 Service 패턴이다. **신규/전 모듈은 §9의 use-case 표준**(`@Injectable` `execute()`, `ApplicationException`/`DomainException` throw, `UNIT_OF_WORK.run` CLS 트랜잭션)을 따른다. 아래는 마이그레이션 이력 이해용으로만 남긴다.
>
> **Why(당시)**: 비즈니스 로직의 유일한 거처. 트랜잭션 경계를 관리하고, 큐 enqueue는 커밋 후 실행하여 데이터 정합성 보장.

### 기본 구조

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { BusinessExceptions } from '@/shared/application/exceptions';
import { DatabaseService } from '@/shared/application/ports';
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
  private readonly {other}Service: {Other}Service,
) {}

// DON'T: DatabaseService를 직접 쿼리에 사용 (Repository 통해야 함)
```

### 트랜잭션 사용

다중 테이블 작업 시 반드시 트랜잭션 사용:

```typescript
async createWithRelated(input: CreateInput) {
  return this.database.$transaction(async (tx) => {
    const entity = await this.{feature}Repository.create(input, tx);
    await this.{related}Repository.create({ {feature}Id: entity.id }, tx);
    return entity;
  });
}
```

### 비동기 큐 enqueue

```typescript
async update(id: string, userId: string, data: UpdateInput) {
  const existing = await this.[feature]Repository.findByIdAndUserId(id, userId);
  if (!existing) {
    throw BusinessExceptions.[feature]NotFound(id);
  }

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
export interface {Feature}Result {
  id: string;
  // ... 도메인별 필드
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

> ⚠️ **역사적 참고 (현재 미사용)** — 이관 이전의 `tx?` 파라미터 Repository 패턴이다. **전 모듈은 §9처럼** 저장소를 포트로 두고 어댑터가 CLS(`TransactionHost.tx`)에서 활성 TX를 읽는다(무인자). 아래는 이력용.
>
> **Why(당시)**: DB 접근의 유일한 지점. `tx?` 파라미터로 트랜잭션 참여를 선택적으로 허용하여 Service가 트랜잭션을 제어.

### 기본 구조

```typescript
import { Injectable } from '@nestjs/common';
import { DatabaseService, type TransactionClient } from '@/shared/application/ports';

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
async findByIdWithRelations(id: string): Promise<{Feature}WithRelations | null> {
  return this.database.{feature}.findUnique({
    where: { id },
    include: {
      relatedEntity: true,
      otherEntity: { select: { field: true } },
    },
  });
}
```

### 민감 데이터 암호화

OAuth 토큰 등 민감 데이터를 DB에 저장할 때 EncryptionService 사용:

```typescript
@Injectable()
export class {Feature}Repository {
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
- 단일 엔티티 책임 (단일 엔티티 → {Feature}Repository)
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
import { {Other}Module } from '../{other}';

@Module({
  imports: [{Other}Module], // {Other}Service 사용 가능
  controllers: [{Feature}Controller],
  providers: [{Feature}Service, {Feature}Repository],
})
export class {Feature}Module {}
```

> `@Global()` 모듈 (DatabaseModule, EncryptionModule, CacheModule 등)은 `imports` 없이 바로 주입 가능.

---

## 6. Import 별칭

```typescript
// @/shared/* — 공유 커널 (tsconfig paths: "@/*" → "src/*")
import { DatabaseService } from '@/shared/application/ports';
import { ApiDoc, ApiSuccessResponse } from '@/shared/presentation/swagger';
import { BusinessExceptions } from '@/shared/application/exceptions';
import { PaginationService } from '@/shared/application/pagination';
import { EncryptionService } from '@/shared/infrastructure/encryption';
import { TypedConfigService } from '@/shared/infrastructure/config';
import { getUserToday, toScheduledTime } from '@/shared/domain/date';
import { Timezone } from '@/shared/presentation/decorators';

// Auth 데코레이터 — auth 모듈에서 import
import { CurrentUser, type CurrentUserPayload } from '../auth/decorators';

// @aido/validators — 공유 스키마 패키지
import { LoginInput, LoginResponse } from '@aido/validators';

// 모듈 내부 — 상대 경로
import { {Feature}Repository } from '../repositories';
import { {Feature}Service } from './{feature}.service';
```

---

## 7. 새 모듈 추가 체크리스트

### 1. Prisma 스키마

- [ ] `prisma/schema.prisma`에 모델 추가
- [ ] `pnpm db:migrate` 실행

### 2. @aido/validators

- [ ] Request/Response 스키마 추가 ([validators.md](./validators.md) 참고)
- [ ] NestJS DTO 추가
- [ ] `pnpm build` 실행

### 3. API 모듈 (클린아키텍처 — 상세는 §9)

- [ ] `domain/` 애그리게잇·VO·도메인 서비스·이벤트 (불변식은 DomainException)
- [ ] `application/ports/*.port.ts` (인터페이스 + Symbol 토큰)
- [ ] `application/use-cases/<name>/<name>.use-case.ts` (쓰기) · `queries/<name>/<name>.use-case.ts` (읽기)
- [ ] `application/facades/{name}.facade.ts` (컨트롤러의 유일 주입 대상)
- [ ] `infrastructure/adapters`·`persistence` (포트 구현, Prisma·벤더·큐)
- [ ] `presentation/{name}.controller.ts` (Facade 주입, Swagger) + `presentation/dtos`
- [ ] `{name}.module.ts` (use-case 배럴 등록) + `index.ts` (Facade·DTO 공개)

### 4. 등록

- [ ] `app.module.ts`에 모듈 import 추가

### 5. 에러 처리

- [ ] `@aido/errors`에 `ErrorCode` 추가 → use-case/도메인에서 `ApplicationException`/`DomainException`으로 throw
- [ ] 새 Unique Constraint가 있으면 `GlobalExceptionFilter`의 constraintMap에 매핑 추가

### 6. 테스트

- [ ] use-case / 애그리게잇 / VO 단위 테스트
- [ ] 통합 테스트 (실 저장소 + 어댑터)
- [ ] E2E 테스트 (openapi 스냅샷 diff 0 확인) + `lint:no-cast`·`lint:boundaries`

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
3. `src/shared/infrastructure/config/schemas/`에 Zod 검증 스키마 추가

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
4. [ ] `pnpm db:migrate`로 DB 마이그레이션 적용
5. [ ] `pnpm dev`로 개발 서버 시작

---

## 9. 클린아키텍처 모듈 규칙

> **전 모듈 표준** (참조 구현: todo). 2026-07 auth 이관 완료로 전 모듈이 이 표준을 따른다(§3·§4 3계층 패턴은 소멸).
> **@nestjs/cqrs 사용 금지** — CommandBus/QueryBus/EventBus/CqrsModule 없음. 유스케이스는 plain `@Injectable()` use-case 클래스, 부수효과는 `DOMAIN_EVENT_PUBLISHER` → EventEmitter2 → `@OnEvent`로 처리한다.

### 디렉터리 구조

```
modules/{name}/
  domain/
    entities/{name}.entity.ts        # AggregateRoot 상속, private ctor + reconstitute + planCreation
    entities/{child}.entity.ts       # 자식 엔티티 (Entity 상속 — 예: todo-item)
    events/*.event.ts                # plain readonly-param 클래스 (과거형 사실, 전이 후 상태를 실음)
    events/{name}-event-names.ts     # eventName 라우팅 키 상수 (예: TODO_EVENTS.CREATED = "todo.created")
    value-objects/*.vo.ts            # EntityId/ValueObject 상속, static create 검증 + reconstitute 무검증
    services/*.ts                    # 순수 도메인 정책 함수 (예: completion-policy, reorder-position)
  application/
    ports/*.port.ts                  # Symbol 토큰 + 인터페이스 (파일당 1포트, 페이로드 계약 소유)
    types.ts                         # 애플리케이션 파라미터 타입 (프레임워크·Prisma 무의존)
    facades/{name}.facade.ts         # 컨트롤러가 주입하는 유일한 지점 — use-case 한 줄 위임
    use-cases/<kebab>/               # 쓰기 use-case 1개 = 엔드포인트 1개 (SRP)
      <kebab>.use-case.ts / .use-case.spec.ts
    queries/<kebab>/                 # 읽기 use-case — 쓰기와 대칭 (read/write 저장소 분리와 미러링)
      <kebab>.use-case.ts / .use-case.spec.ts
    events/*.handler.ts              # @OnEvent 부수효과 구독자
  infrastructure/
    adapters/*.ts                    # 포트 구현 — persistence DAO/타 모듈 Facade에 위임(쿼리 중복 금지)
    persistence/                     # 행 DAO({name}-row.repository) · 응답 매퍼 · Prisma 행 타입
  presentation/                      # {name}.controller.ts · dtos/
```

**배럴 규칙:**

- `use-cases/index.ts`는 `XxxUseCases` 배열, `queries/index.ts`는 `XxxQueryUseCases` 배열을 export — 모듈 providers에 스프레드로 등록
- 공개 배럴(`src/{name}/index.ts`)은 **Facade(+DTO)만** export — use-case·포트·리포지토리는 내부 구현으로 비공개. 예외: 타 모듈이 `@OnEvent`로 구독하는 도메인 이벤트 클래스·이벤트명 상수는 배럴에 export (예: todo의 `TODO_EVENTS`)

### Use-case 규칙

| 규칙 | 내용 |
|------|------|
| 클래스 | plain `@Injectable()` `XxxUseCase` — 단일 `async execute(input: XxxInput): Promise<R>` 메서드, 반환 타입 명시 필수 |
| 입력 타입 | `XxxInput` 인터페이스를 같은 파일에서 export (또는 `application/types.ts` 타입의 별칭) — 커맨드/쿼리 클래스 없음 |
| 예외 | `ApplicationException(ErrorCode.XXX, context)` — 유스케이스 규칙 위반. 도메인 불변식은 `DomainException` |
| 트랜잭션 | `@Inject(UNIT_OF_WORK)` → `uow.run(async () => ...)` — 콜백 무인자, 리포지토리가 CLS(AsyncLocalStorage)에서 활성 TX를 직접 읽는다 (전파 Required). load→mutate→write를 TX 안에 묶는다. `database.$transaction` 직접 호출 금지 |
| 부수효과 | 도메인 이벤트로 — 애그리게잇 `raise()` 적립 → TX 안에서 영속화 + `pullDomainEvents()` 드레인 → **run resolve 후** `await DOMAIN_EVENT_PUBLISHER.publishAll(events)` (커밋 후 `@OnEvent` 구독자가 처리) |
| 캐시 무효화 | 영속화 후 use-case에서 명시적 호출 (`TodoCachePort` 등 캐시 포트) — 도메인 이벤트가 없는 쓰기 경로 포함. 또는 `@OnEvent` 구독으로 처리 |
| 응답 | 애그리게잇에서 직접 만들지 않는다 — 항상 read 포트(`~ReadRepositoryPort`) 재조회 |
| 이벤트 발행 | 발행은 반드시 커밋 후(`run` 콜백 밖) `await`. 퍼블리셔가 EventEmitter2 `emitAsync`를 이벤트 단위로 await하고 비동기 실패를 기록·격리한다 (도메인·애플리케이션은 EventEmitter2 무의존, 포트만 의존) |
| 크로스 모듈 | 타 모듈 구체 클래스 import 금지 — 포트 + 어댑터로 역전, 어댑터는 타 모듈 배럴의 **Facade**에 위임 (예: memo의 `TODO_CREATOR` 포트 → `TodoCreatorAdapter` → `TodoFacade`) |
| 타입 | `as`/`!` 금지(`as`: `pnpm lint:no-cast` · `!`: Biome), 임포트 경계는 `pnpm lint:boundaries`(dependency-cruiser) — CI `lint:arch` 게이트 |
| 가독성 | JSDoc에 흐름 요약, `execute()` 본문은 번호 주석으로 위→아래 단일 경로 |

**작성 예시** (todo `create-todo` — 골격):

```typescript
// application/use-cases/create-todo/create-todo.use-case.ts
export interface CreateTodoInput {
  userId: string;
  data: CreateTodoData; // application/types.ts
  timezone: string;
}

@Injectable()
export class CreateTodoUseCase {
  constructor(
    @Inject(TODO_REPOSITORY) private readonly todoRepository: TodoRepositoryPort,
    @Inject(TODO_READ_REPOSITORY) private readonly todoReadRepository: TodoReadRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisherPort,
  ) {}

  async execute(input: CreateTodoInput): Promise<TodoResponse> {
    // 1. 도메인 생성 계획 (birth 불변식·기본값 — Todo.planCreation)
    // 2. TX: 영속화 + 이벤트 드레인 (콜백 무인자 — 리포지토리가 CLS에서 TX를 읽음)
    const { todoId, events } = await this.uow.run(async () => {
      /* 저장 → todo.pullDomainEvents() 반환 */
    });
    // 3. 커밋 후 도메인 이벤트 발행 (비동기 구독자 완료·실패 관측, 실패는 publisher가 격리)
    await this.eventPublisher.publishAll(events);
    // 4. 응답은 read 포트 재조회
    return this.todoReadRepository.findByIdOrThrow(todoId, input.userId);
  }
}
```

### Facade 규칙

- 위치: `application/facades/{name}.facade.ts` — **컨트롤러(및 타 모듈 어댑터)가 주입하는 유일한 지점**
- use-case들을 생성자 주입하고 메서드마다 **한 줄 위임** (`return this.createTodoUseCase.execute(input);`) — 로직·분기 금지
- Facade의 공개 시그니처가 모듈의 공개 계약 — 시그니처 변경은 계약 변경으로 취급
- 공개 배럴(`src/{name}/index.ts`)은 Facade(+DTO)만 export (+구독용 도메인 이벤트 — 위 배럴 규칙 참조)

### 컨트롤러 규칙 (클린아키텍처 전환분)

- **Facade만 주입** — use-case/리포지토리 직접 주입 금지
- DTO → Input 매핑과 날짜/타임존 파싱(`parseDateOnly`, `parseLocalDateTime`)은 컨트롤러 책임
- Swagger 데코레이터는 마이그레이션 중 **절대 변경 금지** (openapi-contract 스냅샷이 게이트)

### 도메인 이벤트 구독 규칙

- 위치: `application/events/*.handler.ts` — `@Injectable()` 클래스 + `@OnEvent(TODO_EVENTS.CREATED)` 등 이벤트명 상수로 구독
- 실패 전파가 필요한 핸들러는 `@OnEvent(..., { suppressErrors: false })` + `async`로 rejection을 퍼블리셔까지 보존한다. 퍼블리셔가 비동기 실패를 한 번 기록·격리해 다른 이벤트·이미 커밋된 요청에 전파하지 않는다
- 이는 durable retry 보장이 아니다. 유실 불가 부수효과는 별도 내구성 큐/아웃박스를 사용한다
- 판단 규칙(마일스톤·전체완료 등)은 `domain/services/` 정책 함수 호출 — 구독자에 도메인 로직 상주 금지

### 도메인 규칙

- 애그리게잇: `private constructor` + `static reconstitute(props)`. 행동 메서드에서만 상태 전이 + `raise(event)` (이벤트는 전이 후 **사실**을 실음 — 명령 에코 금지)
- 생성 불변식·기본값은 `static planCreation(input)` 단일 지점 — autoincrement id 제약으로 `create()` 팩토리 대신 계획 패턴 (엔티티 JSDoc 참조)
- props는 가능하면 VO로 저장 (예: `schedule: TodoSchedule`) — 불변식이 타입 수준에서 유지
- 자식 엔티티(예: TodoItem)의 불변식(개수 한도·존재·제목)은 애그리게잇 행동 메서드가 소유 — 핸들러의 직접 검증 금지
- 판단 규칙(마일스톤·전체완료·재정렬 계산 등)은 `domain/services/`의 순수 정책 함수로 — 이벤트 핸들러에 상주 금지
- VO: `static create()` 검증(위반 시 `DomainException`) + `static reconstitute()` 무검증 복원(DB 전용)
- Zod는 경계 검증, 도메인 불변식은 자기방어 — 역할이 다르므로 중복이 아니다

---

**문서 버전**: 3.2.0
**최종 수정일**: 2026-07-11
