# API 아키텍처 가이드

**Version**: 1.0.0 · **Last Updated**: 2026-04-23 · **Owner**: Aido Platform Team

> NestJS 기반 백엔드 API의 전체 아키텍처 · 에러 처리 · BullMQ 큐 · 보안 · 공통 모듈

## 관련 문서

| 문서 | 내용 |
|------|------|
| [CLAUDE.md](../CLAUDE.md) | API 앱 진입점 (기술 스택, 핵심 규칙, 문서 네비게이션) |
| [api-conventions.md](./api-conventions.md) | Controller/Service/Repository 계층별 코드 작성 규칙 |
| [validators.md](./validators.md) | @aido/validators 패키지 규칙 (Zod 스키마, NestJS DTO) |
| [prisma.md](./prisma.md) | Prisma 7 가이드 (스키마, 마이그레이션, 트랜잭션) |
| [testing-guide.md](./testing-guide.md) | 종합 테스팅 가이드 (Unit → Integration → E2E) |
| [logging-guide.md](./logging-guide.md) | 로깅 레벨 및 레이어별 패턴 |

---

## 개요

| 항목 | 값 |
|------|-----|
| 프레임워크 | NestJS 11 |
| ORM | Prisma 7 |
| 데이터베이스 | PostgreSQL |
| 검증 | Zod 4.3 + nestjs-zod |
| 문서화 | Swagger (OpenAPI) |
| 비동기 큐 | BullMQ (Redis) — 알림, AI, 스케줄러 등 |
| 캐시 | Memory / Redis (Strategy Pattern) |
| 분산 락 | ILockProvider (Redis / InMemory Strategy) |
| 암호화 | AES-256-GCM (EncryptionService) |

---

## 1. 아키텍처 개요

### 1.1 계층 다이어그램

```
HTTP Request
     ↓
┌──────────────────────────────────────────────────────────┐
│  Middleware (CORS)                                         │
└──────────────────────────────────────────────────────────┘
     ↓
┌──────────────────────────────────────────────────────────┐
│  Guard (JwtAuthGuard → ThrottlerGuard → AdminGuard)       │
│  - @Public() 데코레이터로 인증 스킵                       │
└──────────────────────────────────────────────────────────┘
     ↓
┌──────────────────────────────────────────────────────────┐
│  Controller                                               │
│  - HTTP 요청/응답 처리, DTO 검증, Swagger 문서화           │
└──────────────────────────────────────────────────────────┘
     ↓
┌──────────────────────────────────────────────────────────┐
│  Service                                                  │
│  - 비즈니스 로직, BusinessExceptions 예외 발생             │
│  - QueueService.enqueueXxx()로 비동기 위임 (fire-and-forget)│
│  - 트랜잭션 관리 (database.$transaction)                   │
└──────────────────────────────────────────────────────────┘
     ↓
┌──────────────────────────────────────────────────────────┐
│  Repository                                               │
│  - Prisma 쿼리 캡슐화, tx 지원                            │
│  - EncryptionService로 민감 데이터 암호화                  │
└──────────────────────────────────────────────────────────┘
     ↓
┌──────────────────────────────────────────────────────────┐
│  DatabaseService (Prisma) → PostgreSQL                    │
└──────────────────────────────────────────────────────────┘

     ── 비동기 (BullMQ) ──
┌──────────────────────────────────────────────────────────┐
│  QueueService → BullMQ Queue → Processor → Provider       │
│  - 3회 재시도, exponential backoff (1s → 2s → 4s)          │
│  - PushProvider (Expo) → 푸시 알림 발송                    │
└──────────────────────────────────────────────────────────┘
```

### 1.2 의존성 방향 규칙

| 방향 | 허용 여부 | 예시 |
|------|----------|------|
| Controller → Service | ✅ | `{Feature}Controller → {Feature}Service` |
| Service → Repository | ✅ | `{Feature}Service → {Feature}Repository` |
| Service → 다른 Service | ✅ | `{Feature}Service → {Other}Service` |
| Service → DatabaseService | ✅ (트랜잭션용) | `database.$transaction(...)` |
| Service → QueueService | ✅ | `queueService.enqueueXxx(...)` |
| Processor → Provider/Repository | ✅ | 큐 작업 처리 |
| Repository → DatabaseService | ✅ | `database.{feature}.findUnique(...)` |
| Repository → EncryptionService | ✅ | `encryptionService.encrypt(...)` |
| Controller → Repository | ❌ | Service 거쳐야 함 |
| Controller → DatabaseService | ❌ | |
| Repository → 다른 Repository | ❌ | |
| Repository → Service | ❌ | |

> ⚠️ 위 표는 **레거시 3계층 모듈** 기준. 클린아키텍처로 전환된 모듈(todo)은 §1.4의 규칙을 따른다.

### 1.3 디렉토리 구조

```
apps/api/
├── prisma/
│   ├── schema.prisma           # 데이터베이스 스키마
│   └── migrations/             # 마이그레이션 파일
├── src/
│   ├── main.ts                 # 애플리케이션 진입점
│   ├── app.module.ts           # 루트 모듈
│   ├── common/                 # 공통 모듈 (@common/* 별칭)
│   │   ├── cache/              # CacheModule (Memory/Redis Strategy)
│   │   ├── config/             # AppConfigModule + TypedConfigService
│   │   ├── database/           # DatabaseService (Prisma 래퍼)
│   │   ├── date/               # 날짜/타임존 유틸리티
│   │   ├── dedup/              # DedupModule (알림 중복 방지)
│   │   ├── decorators/         # @Timezone 등
│   │   ├── encryption/         # EncryptionService (AES-256-GCM)
│   │   ├── entitlement/        # EntitlementService (플랜별 제한)
│   │   ├── exception/          # BusinessException + GlobalExceptionFilter
│   │   ├── lock/               # LockModule (Redis/InMemory Strategy)
│   │   ├── logger/             # LoggerModule (Pino)
│   │   ├── pagination/         # PaginationService (오프셋 + 커서)
│   │   ├── redis/              # RedisModule (REDIS_CLIENT)
│   │   ├── response/           # ResponseTransformInterceptor
│   │   ├── swagger/            # ApiDoc, ApiSuccessResponse 등
│   │   └── throttle/           # RedisThrottlerStorage
│   └── modules/                # 도메인 모듈
│       ├── admin/              # 관리자 기능
│       ├── admin-notification/ # 관리자 알림 (Discord 등)
│       ├── ai/                 # AI 자연어 파싱 (Gemini)
│       ├── ai-report/          # AI 주간/월간 리포트
│       ├── ai-suggestion/      # AI 반복 제안
│       ├── auth/               # 인증 (JWT, OAuth 4사)
│       ├── cheer/              # 응원 메시지
│       ├── daily-completion/   # 일일 완료 통계
│       ├── email/              # 이메일 발송
│       ├── follow/             # 팔로우 관계
│       ├── health/             # 헬스체크
│       ├── inquiry/            # 문의
│       ├── notification/       # 알림 (BullMQ + 푸시)
│       ├── nudge/              # 찌르기
│       ├── scheduler/          # 스케줄러 (리마인더)
│       ├── subscription/       # 구독/결제
│       ├── todo/               # 할 일 (클린아키텍처+CQRS, §1.4)
│       │   ├── domain/         #   애그리게잇·VO·이벤트·도메인 서비스
│       │   ├── application/    #   포트·유스케이스(커맨드)·쿼리·이벤트 핸들러
│       │   ├── infrastructure/ #   어댑터 (포트 구현)
│       │   └── ...             #   controller·행 repository·mapper·dtos
│       ├── todo-category/      # 할 일 카테고리
│       ├── user-settings/      # 사용자 설정/프로필
│       └── weekly-achievement/ # 주간 달성 통계
└── test/
    ├── e2e/                    # E2E 테스트
    ├── integration/            # 통합 테스트
    ├── mocks/                  # 테스트 Mock
    └── setup/                  # 테스트 설정
```

---

### 1.4 클린아키텍처 모듈 (CQRS) — todo부터 적용

todo 모듈은 3계층에서 클린아키텍처+CQRS로 완전 전환됐다. 신규 표준이며, 다른 모듈도 순차 이관 예정.
코드 작성 규칙 상세: [api-conventions.md §9](./api-conventions.md#9-클린아키텍처cqrs-모듈-규칙)

```
HTTP Request
     ↓
Controller ── DTO→Command/Query 매핑, 날짜·타임존 파싱만 담당
     ↓
CommandBus / QueryBus (@nestjs/cqrs)
     ↓
Application: 커맨드/쿼리 핸들러 (유스케이스당 1개, SRP)
     │  · 포트(Symbol 토큰 인터페이스)에만 의존
     │  · TRANSACTION_MANAGER.run(tx => ...) 로 트랜잭션
     │  · ApplicationException(ErrorCode)으로 유스케이스 규칙 위반 표현
     ↓
Domain: 애그리게잇(AggregateRoot) · VO · 도메인 서비스 · 도메인 이벤트
     │  · 불변식 위반은 DomainException
     │  · 상태 전이 메서드에서 apply(event) → 영속화 후 eventBus.publishAll(pullDomainEvents())
     ↓
Infrastructure: 어댑터 (포트 구현)
     │  · Prisma{X}Repository → 레거시 행 Repository에 위임 + 도메인/응답 매핑
     │  · 크로스모듈 어댑터 → 타 모듈 서비스에 thin delegation
     ↓
행 Repository → DatabaseService (Prisma) → PostgreSQL

     ── 부수효과 (커밋 후) ──
@EventsHandler ── TodoCreated/Updated/Rescheduled/Deleted → 리마인더 스케줄/취소
              └─ TodoToggled → 리마인더 취소 + 스트릭 + 친구완료/마일스톤 큐
```

**의존성 방향 (클린아키텍처 모듈)**

| 방향 | 허용 여부 | 비고 |
|------|----------|------|
| Controller → CommandBus/QueryBus | ✅ | 서비스 직접 호출 금지 |
| application → domain | ✅ | 핸들러가 애그리게잇/VO/도메인 서비스 사용 |
| application → 포트(인터페이스) | ✅ | `@Inject(SYMBOL_TOKEN)` |
| infrastructure → application 포트 | ✅ | 어댑터가 포트 구현 |
| infrastructure → 레거시 Repository/타 모듈 서비스 | ✅ | 위임 전용 (쿼리 중복 금지) |
| domain → application/infrastructure | ❌ | 도메인은 안쪽으로만 |
| application → Prisma/타 모듈 구체 클래스 | ❌ | 포트로 역전 |
| 외부 모듈 → 이 모듈의 서비스 | ❌ | CommandBus로 커맨드 디스패치 (memo·ai-suggestion 참조) |
| domain/application/infrastructure에서 `as`/`!` | ❌ | `pnpm lint:no-cast` 수동 게이트 (CI 미연결) |

**계약 안전장치**: `test/e2e/openapi-contract.e2e-spec.ts` 스냅샷이 전체 API 계약을 고정 —
마이그레이션 중 스냅샷 diff 0 = 클라이언트 영향 0.

## 2. 에러 처리 체계

### 2.1 에러 흐름

```
예외 발생
  ├── BusinessException (도메인 비즈니스 에러)
  │     → 정의된 errorCode + message + httpStatus 그대로 반환
  │
  ├── HttpException (NestJS 내장 — 검증 실패 등)
  │     → SYS_0002 (validation) 또는 SYS_0001로 래핑
  │     → isDevelopment일 때만 details 포함
  │
  ├── Prisma P2002 (Unique constraint violation)
  │     → constraintMap으로 BusinessException 매핑
  │     → 매핑 없으면 concurrentModification()
  │
  └── Unknown (예기치 못한 에러)
        → 500 + SYS_0001
        → isDevelopment일 때만 details + stack 포함

모든 에러 → GlobalExceptionFilter → 통일된 JSON 응답
```

### 2.2 BusinessException + BusinessExceptions 팩토리

> **Why**: 에러 생성의 유일한 팩토리. 에러 코드/메시지 변경 시 한 곳만 수정하면 일괄 반영.

`BusinessException`은 `HttpException`을 확장한 도메인 예외 클래스. `BusinessExceptions`는 도메인별 팩토리 메서드를 제공하는 정적 클래스.

**위치**: `src/common/exception/services/business-exception.service.ts`

```typescript
// BusinessException 클래스
export class BusinessException extends HttpException {
  constructor(
    public readonly errorCode: ErrorCodeType,
    public readonly details?: unknown,
    message?: string,
    statusCode?: number,
  ) {
    const errorDef = Errors[errorCode];
    super({
      success: false,
      error: { code: errorCode, message: message || errorDef.message, details },
      timestamp: Date.now(),
    }, statusCode || errorDef.httpStatus);
  }
}
```

```typescript
// 사용법 — Service에서 팩토리 메서드 호출
throw BusinessExceptions.todoNotFound(todoId);
throw BusinessExceptions.aiUsageLimitExceeded(used, limit);
throw BusinessExceptions.socialAccountNotLinked(provider, providerAccountId, email);
```

**도메인별 팩토리 메서드 목록:**

| 도메인 | 주요 메서드 |
|--------|-----------|
| Common | `userNotFound()`, `todoNotFound()`, `invalidParameter()`, `internalServerError()` |
| Concurrency | `optimisticLockError()`, `concurrentModification()` |
| JWT | `invalidToken()`, `tokenExpired()`, `tokenMalformed()`, `refreshTokenInvalid()`, `authenticationRequired()` |
| Social Login | `socialAuthFailed()`, `socialTokenInvalid()`, `socialEmailNotProvided()`, `socialAccountNotLinked()` |
| Email Auth | `emailAlreadyRegistered()`, `emailNotVerified()`, `invalidCredentials()`, `invalidPassword()` |
| Account | `accountNotFound()`, `accountAlreadyExists()`, `accountSuspended()`, `accountLocked()`, `cannotUnlinkLastAccount()` |
| Session | `sessionNotFound()`, `sessionExpired()`, `sessionRevoked()`, `tokenReuseDetected()` |
| Verification | `verificationCodeInvalid()`, `verificationCodeExpired()`, `verificationResendTooSoon()` |
| Follow | `followRequestAlreadySent()`, `alreadyFriends()`, `cannotFollowSelf()`, `notFriends()` |
| Notification | `invalidPushToken()`, `pushSendFailed()`, `notificationNotFound()` |
| Nudge/Cheer | `nudgeLimitExceeded()`, `cheerLimitExceeded()`, `nudgeTargetNotFound()` |
| AI | `aiServiceUnavailable()`, `aiParseFailed()`, `aiUsageLimitExceeded()` |
| TodoCategory | `todoCategoryNotFound()`, `todoCategoryNameDuplicate()`, `todoCategoryMinimumRequired()` |
| Admin | `adminRequired()`, `adminNotificationTargetNotFound()` |
| Achievement | `weeklyAchievementAlreadyExists()` |

### 2.3 GlobalExceptionFilter 3단계 처리

**위치**: `src/common/exception/filters/global-exception.filter.ts`

```typescript
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    // 1단계: BusinessException → 정의된 응답 그대로
    if (exception instanceof BusinessException) { ... }

    // 2단계: HttpException → SYS_0002 (validation) 또는 SYS_0001
    else if (exception instanceof HttpException) { ... }

    // 3단계: Prisma P2002 → constraintMap 매핑
    else if (exception instanceof PrismaClientKnownRequestError
             && exception.code === "P2002") {
      const businessException = this.mapP2002ToBusinessException(exception);
    }

    // Fallback: Unknown → 500 + SYS_0001
    else { ... }
  }
}
```

**로깅 전략:**
- HTTP 500+ → `logger.error()` (stack trace 포함)
- HTTP 4xx → `logger.warn()`
- `isDevelopment`일 때만 응답에 `details` 필드 포함

### 2.4 P2002 constraintMap 매핑

Prisma Unique Constraint 위반 시 비즈니스 예외로 자동 매핑:

| Constraint Key | 매핑되는 BusinessException |
|---------------|--------------------------|
| `User_email_key` / `email` | `emailAlreadyRegistered()` |
| `User_userTag_key` / `userTag` | `internalServerError({ detail: "userTag collision" })` |
| `TodoCategory_userId_name_key` / `userId_name` | `todoCategoryNameDuplicate()` |
| `Follow_followerId_followingId_key` / `followerId_followingId` | `followRequestAlreadySent()` |
| `Account_provider_providerAccountId_key` / `provider_providerAccountId` | `accountAlreadyExists()` |
| `Account_userId_provider_key` / `userId_provider` | `accountAlreadyExists()` |
| `Notification_daily_dedup` / `userId_type_notificationDate` | `concurrentModification()` |
| `Notification_friend_dedup` / `userId_type_friendId_notificationDate` | `concurrentModification()` |
| (매핑 없음) | `concurrentModification()` (기본값) |

> 각 constraint에 대해 Prisma naming(`Table_col_key`)과 축약형(`col`) 양쪽 모두 등록.

### 2.5 응답 형식

**성공 응답** — `ResponseTransformInterceptor`가 자동 래핑:

```json
{
  "success": true,
  "data": { ... },
  "timestamp": 1707200000000
}
```

**에러 응답** — `GlobalExceptionFilter`가 자동 래핑:

```json
{
  "success": false,
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "사용자를 찾을 수 없습니다",
    "details": { ... }       // isDevelopment일 때만
  },
  "timestamp": 1707200000000
}
```

**페이지네이션 응답 (오프셋):**

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
  "timestamp": 1707200000000
}
```

**페이지네이션 응답 (커서):**

```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "nextCursor": "cuid_or_number",
      "hasNext": true,
      "size": 20
    }
  },
  "timestamp": 1707200000000
}
```

### 2.6 DO / DON'T

**DO ✅**
- Service에서 `BusinessExceptions.xxx()` 팩토리 메서드로 예외 발생
- 새 Unique Constraint 추가 시 constraintMap에 매핑 등록
- QueueService `enqueueXxx()` 메서드로 비동기 부수효과 위임

**DON'T ❌**
- Controller에서 try-catch (GlobalExceptionFilter가 담당)
- `new HttpException()` 직접 사용 (BusinessExceptions 팩토리 사용)
- 에러 응답 형식 직접 구성 (GlobalExceptionFilter가 담당)
- Repository에서 예외 발생 (Service에서 담당)

---

## 3. BullMQ 큐 아키텍처

### 3.1 큐 목록

| 큐 이름 | 모듈 | 용도 |
|---------|------|------|
| `notification` | Notification | 푸시 알림 발송 |
| `admin-notification` | AdminNotification | Discord 관리자 알림 |
| `timezone-reminder` | Scheduler | 타임존별 리마인더 스윕 |
| `todo-reminder` | Scheduler | 개별 할 일 리마인더 |
| `ai-suggestion-analysis` | AiSuggestion | AI 반복 패턴 분석 |
| `ai-report-generation` | AiReport | AI 주간/월간 리포트 |
| `account-purge` | Auth | 탈퇴 계정 정리 |

### 3.2 BullMQ 글로벌 설정

**위치**: `src/app.module.ts`

```typescript
BullModule.forRootAsync({
  inject: [REDIS_CLIENT],
  useFactory: (redis: Redis) => ({
    connection: redis as never,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential" as const, delay: 1_000 },
      removeOnComplete: true,
      removeOnFail: { count: 100, age: 86_400 },
    },
  }),
}),
```

| 옵션 | 값 | 설명 |
|------|-----|------|
| `attempts` | 3 | 최대 재시도 횟수 |
| `backoff` | exponential, 1s | 1s → 2s → 4s |
| `removeOnComplete` | true | 성공 시 job 삭제 |
| `removeOnFail` | count: 100, age: 1일 | 실패 job 보관 제한 |

### 3.3 QueueService 패턴 (enqueue 담당)

```typescript
// src/modules/{name}/queue/{name}-queue.service.ts
import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { QUEUE_NAME } from "./{name}-queue.constants";

@Injectable()
export class [Feature]QueueService {
  readonly #logger = new Logger([Feature]QueueService.name);

  constructor(
    @InjectQueue(QUEUE_NAME) private readonly queue: Queue<[Feature]JobData>,
  ) {}

  /** fire-and-forget: 에러가 호출자에 전파되지 않음 */
  enqueueXxx(data: XxxPayload): void {
    this.#enqueueAsync(JobName.XXX, data).catch((error) => {
      this.#logger.error(`큐 등록 실패: ${error.message}`);
    });
  }

  async #enqueueAsync(name: string, data: unknown): Promise<void> {
    await this.queue.add(name, data);
  }
}
```

### 3.4 Processor 패턴 (job 처리 담당)

```typescript
// src/modules/{name}/queue/{name}-queue.processor.ts
import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { QUEUE_NAME } from "./{name}-queue.constants";

@Processor(QUEUE_NAME)
export class [Feature]Processor extends WorkerHost {
  async process(job: Job<[Feature]JobData>): Promise<void> {
    switch (job.name) {
      case JobName.TYPE_A:
        return this.#handleTypeA(job.data as TypeAData);
      case JobName.TYPE_B:
        return this.#handleTypeB(job.data as TypeBData);
    }
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job | undefined, error: Error): void {
    this.logger.error(`Job 실패: ${job?.id} / ${job?.name}`, error.stack);
  }
}
```

### 3.5 Job 패턴 (스케줄러 등록 담당)

```typescript
// src/modules/{name}/jobs/{name}.job.ts
import { Injectable, type OnModuleInit } from "@nestjs/common";

@Injectable()
export class [Feature]Job implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    // cron 스케줄러 등록
    await this.queue.upsertJobScheduler("scheduler-id", {
      pattern: "0 * * * *",  // 매시 정각
    }, { name: JobName.SWEEP, data: {} });
  }

  async handleSweep(): Promise<void> {
    // Processor에서 호출됨
  }
}
```

### 3.6 Service에서 큐 사용 패턴

```typescript
// src/modules/{name}/services/{name}.service.ts
@Injectable()
export class [Feature]Service {
  constructor(
    private readonly [feature]QueueService: [Feature]QueueService,
    private readonly database: DatabaseService,
  ) {}

  async create(input: CreateInput): Promise<Result> {
    // 1. 비즈니스 로직 (트랜잭션)
    const result = await this.database.$transaction(async (tx) => {
      // ... DB 작업
      return created;
    });

    // 2. 트랜잭션 커밋 후 비동기 큐 enqueue (fire-and-forget)
    this.[feature]QueueService.enqueueXxx({ ... });

    return result;
  }
}
```

> **핵심 규칙**: 트랜잭션 커밋 후 enqueue. 트랜잭션 내부에서 enqueue하면 롤백 시 고아 job 발생.

### 3.7 새 큐 추가 체크리스트

1. [ ] `{name}-queue.constants.ts` — 큐 이름 상수, Job 이름 enum
2. [ ] `{name}-queue.service.ts` — `enqueueXxx()` 메서드 (fire-and-forget)
3. [ ] `{name}-queue.processor.ts` — `@Processor` + `WorkerHost` + switch/case
4. [ ] `{name}.module.ts` — `BullModule.registerQueue({ name: QUEUE_NAME })` imports에 추가
5. [ ] `test/e2e/helpers/e2e-app-factory.ts` — `BULL_QUEUES`, `BULL_PROCESSORS`, `BULL_JOBS`에 등록

### 3.8 PushProvider Strategy Pattern

**위치**: `src/modules/notification/providers/`

```typescript
// push-provider.interface.ts
export interface PushProvider {
  readonly name: string;
  send(payload: PushPayload): Promise<PushResult>;
  sendBatch(payloads: PushPayload[]): Promise<BatchPushResult>;
  validateToken(token: string): boolean;
}

export const PUSH_PROVIDER = Symbol('PUSH_PROVIDER');
```

| 항목 | PushPayload 필드 |
|------|-----------------|
| 필수 | `token`, `title`, `body` |
| 선택 | `data?`, `badge?`, `sound?`, `channelId?`, `priority?`, `ttl?` |

| 항목 | BatchPushResult 필드 |
|------|---------------------|
| 통계 | `total`, `successCount`, `failureCount` |
| 상세 | `results: PushResult[]`, `invalidTokens: string[]` |

**현재 구현**: `ExpoPushProvider` (Expo Push Notification Service)

```typescript
// expo-push.provider.ts
@Injectable()
export class ExpoPushProvider implements PushProvider {
  readonly name = 'expo';

  validateToken(token: string): boolean {
    return Expo.isExpoPushToken(token);
  }

  async sendBatch(payloads: PushPayload[]): Promise<BatchPushResult> {
    // 유효 토큰 필터링 → chunk 분할 → Expo API 호출
    // invalidTokens 리스트 반환 (토큰 정리용)
  }
}
```

---

## 4. 보안/인증 체계

### 4.1 JWT 이중 토큰

| 토큰 | 용도 | 만료 |
|------|------|------|
| Access Token | API 인증 | 짧음 (분 단위) |
| Refresh Token | Access Token 재발급 | 길음 (일 단위) |

- Refresh Token은 DB에 저장, Token Family 기반 재사용 탐지
- `tokenReuseDetected()` 시 해당 Family의 모든 세션 무효화

### 4.2 Guard 체계

**Guard 적용 순서** (app.module.ts 글로벌 등록):

```
JwtAuthGuard (인증, 글로벌 — @Public()으로 스킵)
     ↓
ThrottlerGuard (Rate Limiting, 글로벌)
     ↓
AdminGuard (관리자 권한, 엔드포인트별)
```

**위치**: `src/modules/auth/guards/`

| Guard | 파일 | 역할 |
|-------|------|------|
| `JwtAuthGuard` | `jwt-auth.guard.ts` | JWT Access Token 검증, `@Public()` 지원 |
| `JwtRefreshGuard` | `jwt-refresh.guard.ts` | JWT Refresh Token 검증 |
| `AdminGuard` | `admin.guard.ts` | `user.role === 'ADMIN'` 확인 |

```typescript
// JwtAuthGuard — @Public() 스킵 패턴
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }

  handleRequest<TUser>(err: Error | null, user: TUser | false): TUser {
    if (err || !user) {
      throw BusinessExceptions.invalidToken({ reason: err?.message });
    }
    return user;
  }
}
```

### 4.3 LastActiveInterceptor (글로벌)

**위치**: `src/modules/auth/interceptors/last-active.interceptor.ts`

`APP_INTERCEPTOR`로 글로벌 등록. 모든 인증된 요청에서 `User.lastActiveAt`을 업데이트.

```typescript
// 패턴: in-memory 쓰로틀 + fire-and-forget DB 업데이트
@Injectable()
export class LastActiveInterceptor implements NestInterceptor {
  static readonly THROTTLE_MS = 60 * 60 * 1000; // 1시간
  readonly #throttleMap = new Map<string, number>(); // userId → lastUpdatedAt

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const user = context.switchToHttp().getRequest().user;
    if (user?.userId) {
      this.#touchLastActive(user.userId); // fire-and-forget
    }
    return next.handle();
  }
}
```

| 항목 | 설명 |
|------|------|
| 쓰로틀 | 같은 userId에 대해 1시간 내 중복 업데이트 방지 |
| 비차단 | `.catch()`로 에러 처리, 응답 지연 없음 |
| 메모리 정리 | 1시간 주기 `setInterval`로 만료 항목 삭제 |

### 4.4 OAuth 4사 자동연동 규칙

**위치**: `src/modules/auth/services/oauth.service.ts`

**Trusted vs Untrusted Provider:**

| 분류 | Provider | 이메일 검증 |
|------|----------|-----------|
| Trusted | Google, Apple | 이메일이 플랫폼 차원에서 검증됨 |
| Untrusted | Kakao, Naver | 이메일 검증 보장 안 됨 |

**자동연동 규칙:**

```
같은 이메일의 기존 사용자가 있을 때:
  ├── Trusted Provider + emailVerified → 자동 계정 연동 (Auto-Link)
  │   └── 트랜잭션: Account 생성 + SecurityLog("OAUTH_AUTO_LINKED")
  │
  └── Untrusted Provider 또는 !emailVerified → 수동 연동 요구
      └── throw socialAccountNotLinked() + SecurityLog("OAUTH_LINK_REQUIRED")
```

```typescript
// oauth.service.ts — 핵심 로직
private async _handleEmailConflict(...) {
  const isTrusted = this._isTrustedProvider(provider);  // Google, Apple
  const isEmailVerified = options.emailVerified === true;

  if (isTrusted && isEmailVerified) {
    // Auto-link: 신뢰할 수 있는 제공자의 검증된 이메일
    await this._database.$transaction(async (tx) => {
      await this._accountRepository.createOAuthAccount({ ... }, tx);
      await this._securityLogRepository.create({
        event: SECURITY_EVENT.OAUTH_AUTO_LINKED,
        metadata: { provider, autoLinked: true, reason: 'trusted_provider_verified_email' },
      }, tx);
    });
    return this._createSessionAndTokens(...);
  }

  // 수동 연동 필요
  throw BusinessExceptions.socialAccountNotLinked(provider, providerAccountId, email);
}
```

### 4.5 EncryptionService (AES-256-GCM)

**위치**: `src/common/encryption/encryption.service.ts`

| 항목 | 값 |
|------|-----|
| 알고리즘 | AES-256-GCM |
| 키 파생 | `scryptSync(TOKEN_ENCRYPTION_KEY, SALT, 32)` |
| 저장 형식 | `iv:authTag:encrypted` (각각 base64) |
| 환경변수 | `TOKEN_ENCRYPTION_KEY` (최소 32자) |
| 모듈 | `@Global()` 등록 → 어디서든 주입 가능 |

```typescript
@Injectable()
export class EncryptionService {
  encrypt(plaintext: string): string { ... }
  decrypt(ciphertext: string): string { ... }
  isEncrypted(value: string): boolean { ... }
  decryptSafe(value: string): string {
    // 암호화된 값이면 복호화, 평문이면 그대로 반환 (마이그레이션 호환)
    return this.isEncrypted(value) ? this.decrypt(value) : value;
  }
}
```

**사용 위치**: `{Feature}Repository`에서 민감 데이터 암호화/복호화

```typescript
// Repository에서 저장 시
data.accessToken ? this.encryptionService.encrypt(data.accessToken) : null

// Repository에서 조회 시
this.encryptionService.decryptSafe(account.accessToken)
```

---

## 5. 공통 모듈 패턴

### 5.1 @Global() 모듈 목록

| 모듈 | 파일 | 제공 서비스 |
|------|------|-----------|
| `DatabaseModule` | `common/database/` | `DatabaseService` (Prisma 래퍼) |
| `EncryptionModule` | `common/encryption/` | `EncryptionService` |
| `CacheModule` | `common/cache/` | `ICacheService`, `CacheService` |
| `LoggerModule` | `common/logger/` | 글로벌 Logger |
| `ExceptionModule` | `common/exception/` | `GlobalExceptionFilter` |
| `ResponseModule` | `common/response/` | `ResponseTransformInterceptor` |
| `PaginationModule` | `common/pagination/` | `PaginationService` |
| `RedisModule` | `common/redis/` | `REDIS_CLIENT` (ioredis) |
| `LockModule` | `common/lock/` | `ILockProvider` (Redis/InMemory Strategy) |
| `EntitlementModule` | `common/entitlement/` | `EntitlementService` (플랜별 제한) |
| `DedupModule` | `common/dedup/` | 알림 중복 방지 |

> `@Global()` 모듈은 `imports` 없이 어디서든 DI 가능.

### 5.2 Dynamic Module 패턴

```typescript
// CacheModule.forRoot() 패턴
@Global()
@Module({})
export class CacheModule {
  static forRoot(): DynamicModule {
    return {
      module: CacheModule,
      providers: [cacheProvider, CacheService],
      exports: [CACHE_SERVICE, CacheService],
    };
  }

  static forTesting(adapter: ICacheService): DynamicModule { ... }
}
```

```typescript
// LoggerModule.forRootAsync() 패턴
@Global()
@Module({})
export class LoggerModule {
  static forRootAsync(): DynamicModule { ... }
}
```

### 5.3 Strategy Pattern: CacheAdapter (Memory/Redis)

**위치**: `src/common/cache/`

```
CacheModule.forRoot()
     │
     ├── CACHE_TYPE === 'redis' → RedisCacheAdapter
     └── CACHE_TYPE === 'memory' → InMemoryCacheAdapter
                                         │
                                   둘 다 ICacheService 구현
```

**ICacheService 인터페이스:**

```typescript
export interface ICacheService {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttl?: TtlValue): Promise<void>;
  del(key: string): Promise<void>;
  delByPattern(pattern: string): Promise<number>;
  reset(): Promise<void>;
  wrap<T>(key: string, factory: () => Promise<T>, ttl?: TtlValue): Promise<T>;
  mget<T>(keys: string[]): Promise<(T | undefined)[]>;
  mset<T>(entries: Array<{ key: string; value: T; ttl?: TtlValue }>): Promise<void>;
  has(key: string): Promise<boolean>;
  ttl(key: string): Promise<number>;
  touch(key: string, ttl: TtlValue): Promise<boolean>;
}

export type TtlValue = number | `${number}${'s' | 'm' | 'h' | 'd'}`;
```

**TTL 표현**: `60000` (ms), `'30s'`, `'5m'`, `'1h'`, `'7d'`

### 5.4 TypedConfigService 래퍼

**위치**: `src/common/config/services/config.service.ts`

NestJS `ConfigService`를 타입 안전하게 래핑:

```typescript
@Injectable()
export class TypedConfigService {
  constructor(private configService: NestConfigService<EnvConfig, true>) {}

  get<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
    return this.configService.get(key, { infer: true });
  }

  // 편의 getter
  get isDevelopment(): boolean { return this.get('NODE_ENV') === 'development'; }
  get isProduction(): boolean { return this.get('NODE_ENV') === 'production'; }
  get isTest(): boolean { return this.get('NODE_ENV') === 'test'; }

  // 그룹별 getter
  get googleOAuth() { return { clientId, clientSecret, callbackUrl, isConfigured }; }
  get cache() { return { type, defaultTtlMs, maxItems, cleanupIntervalMs }; }
  get tokenEncryptionKey(): string { return this.get('TOKEN_ENCRYPTION_KEY'); }
}
```

> **Zod 스키마 기반 환경변수 검증**: `src/common/config/schemas/` 하위에 `app.schema.ts`, `security.schema.ts`, `cache.schema.ts` 등에서 `z.object()`로 정의.

### 5.5 PaginationService (오프셋 + 커서)

**위치**: `src/common/pagination/services/pagination.service.ts`

**오프셋 기반:**

```typescript
// 정규화
const params = paginationService.normalizePagination({ page: 1, size: 20 });
// → { page: 1, size: 20, skip: 0, take: 20 }

// 응답 생성
return paginationService.createPaginatedResponse({
  items, page: params.page, size: params.size, total,
});
// → { items, pagination: { page, size, total, totalPages, hasNext, hasPrevious } }
```

**커서 기반 (Generic):**

```typescript
// 정규화 — take = size + 1 (hasNext 판단용)
const params = paginationService.normalizeCursorPagination<string>({
  cursor: 'cuid_xxx', size: 20,
});

// 응답 생성 — items 개수로 hasNext 판단
return paginationService.createCursorPaginatedResponse<TodoItem, string>({
  items, size: params.size,
});
// → { items, pagination: { nextCursor, hasNext, size } }
```

> `CursorType = string | number` — CUID, Auto-increment ID 모두 지원.

---

## 6. 타임존 처리

### 6.1 규칙

| 항목 | 규칙 |
|------|------|
| 저장 | UTC (PostgreSQL TIMESTAMPTZ) |
| 전송 | ISO 8601 UTC (`2026-02-06T10:30:00.000Z`) |
| 날짜 경계 판단 | 클라이언트 `X-Timezone` 헤더 기준 |
| 기본값 | `X-Timezone` 미전송 시 `UTC` |

### 6.2 @Timezone() 데코레이터 + X-Timezone 헤더

```typescript
import { Timezone } from '@/common/decorators';
import { ApiHeader } from '@nestjs/swagger';

@ApiHeader({
  name: 'X-Timezone',
  required: false,
  description: '사용자 타임존 (IANA, 기본값: UTC)',
  example: 'Asia/Seoul',
})
@Post()
async create(
  @Body() dto: CreateTodoDto,
  @Timezone() timezone: string,  // X-Timezone 헤더 값 추출
) {
  return this.service.create(dto, timezone);
}
```

**타임존이 필요한 API:**

| 모듈 | 엔드포인트 | 용도 |
|------|-----------|------|
| Todo | `POST /todos`, `PATCH /todos/:id`, `PATCH /todos/:id/complete` | 날짜 경계 판단, 스케줄 시간 변환 |
| Cheer | `POST /cheers`, `GET /cheers/limit` | 일일 제한 리셋 기준 |
| Nudge | `POST /nudges`, `GET /nudges/limit` | 일일 제한 리셋 기준 |

### 6.3 날짜 유틸리티

**위치**: `src/common/date/`

```typescript
import { todayInTimezone, parseLocalDateTime, startOfDayInTimezone, midnightInTimezone } from '@/common/date';

// 사용자의 "오늘" 날짜를 UTC midnight Date로 반환
const today = todayInTimezone(timezone);

// 사용자의 로컬 날짜+시간 → UTC 변환
const scheduledAt = parseLocalDateTime('2026-02-06', '14:00', timezone);

// 특정 시점의 타임존 기준 날짜를 UTC midnight로 반환 (DATE 컬럼 비교용)
const dayStart = startOfDayInTimezone(date, timezone);

// 타임존 자정의 실제 UTC timestamp (TIMESTAMPTZ 범위 쿼리용)
const midnight = midnightInTimezone(date, timezone);
```

---

## 7. 도메인 모듈 상세

### 7.1 모듈 의존성 (app.module.ts 등록 순서)

```typescript
// app.module.ts imports 순서
imports: [
  // 1. 설정 (최우선 로드)
  AppConfigModule,

  // 2. 모니터링
  SentryModule.forRoot(),

  // 3. 인프라
  DatabaseModule,
  EncryptionModule,
  RedisModule.forRoot(),
  CacheModule.forRoot(),
  LockModule.forRoot(),
  BullModule.forRootAsync({ ... }),

  // 4. 글로벌 모듈
  EntitlementModule,
  LoggerModule.forRootAsync(),
  ExceptionModule,
  ResponseModule,
  PaginationModule,
  ThrottlerModule.forRootAsync({ ... }),

  // 5. 도메인 모듈
  AdminModule, AdminNotificationModule, AiModule, AiReportModule,
  AiSuggestionModule, AuthModule, CheerModule, DailyCompletionModule,
  FollowModule, HealthModule, InquiryModule, NotificationModule,
  NudgeModule, SchedulerModule, SubscriptionModule, TodoModule,
  TodoCategoryModule, UserSettingsModule, WeeklyAchievementModule,
],
providers: [
  AppService,
  { provide: APP_GUARD, useClass: JwtAuthGuard },
  { provide: APP_GUARD, useClass: ThrottlerGuard },
  { provide: APP_INTERCEPTOR, useClass: LastActiveInterceptor },
],
```

| 모듈 | 설명 | 주요 의존성 |
|------|------|-----------|
| **Auth** | JWT 인증, OAuth 4사, 회원 관리, 세션 | EncryptionService, EmailModule |
| **Todo** | 할 일 CRUD, 완료 처리, 정렬 | NotificationQueueService, FollowService |
| **TodoCategory** | 카테고리 CRUD, 기본 카테고리 | TodoModule (할 일 이동) |
| **Follow** | 팔로우/언팔로우, 친구 관계 | NotificationQueueService |
| **Cheer** | 응원 메시지 전송 | FollowService, NotificationQueueService |
| **Nudge** | 찌르기 알림 전송 | FollowService, NotificationQueueService |
| **AI** | 자연어 → Todo 파싱 (Gemini) | CacheService, EntitlementService |
| **AiReport** | AI 주간/월간 리포트 생성 | AiProvider, BullMQ |
| **AiSuggestion** | AI 반복 패턴 분석/제안 | AiProvider, BullMQ |
| **Notification** | 알림 저장/발송, 토큰 관리 | PushProvider (Expo), BullMQ |
| **Scheduler** | 스케줄러 (리마인더) | BullMQ, NotificationQueueService |
| **Subscription** | 구독/결제 관리 | EntitlementService |
| **AdminNotification** | 관리자 알림 (Discord) | BullMQ |
| **DailyCompletion** | 일일 완료 통계 집계 | - |
| **Email** | 이메일 발송 | - |
| **Inquiry** | 문의 접수 | AdminNotifier |
| **Admin** | 관리자 기능 | AdminGuard |
| **UserSettings** | 사용자 설정/프로필/스트릭 | AuthModule |
| **WeeklyAchievement** | 주간 달성 통계 | DailyCompletionModule |
| **Health** | 헬스체크 | - |

### 7.2 핵심 모듈

**Auth 모듈:**

```
src/modules/auth/
├── auth.module.ts
├── controllers/
│   ├── auth.controller.ts       # 로그인/회원가입
│   ├── oauth.controller.ts      # OAuth 4사
│   ├── session.controller.ts    # 세션 관리
│   └── account.controller.ts    # 계정 관리 (탈퇴 등)
├── services/
│   ├── auth.service.ts          # 로그인/회원가입/토큰 관리
│   ├── oauth.service.ts         # OAuth 4사 연동
│   ├── password.service.ts      # 비밀번호 해싱
│   ├── password-management.service.ts  # 비밀번호 변경/찾기
│   ├── session.service.ts       # 세션 관리
│   ├── token.service.ts         # JWT 토큰 발급/검증
│   └── verification.service.ts  # 이메일 인증 코드
├── repositories/
│   ├── user.repository.ts
│   ├── account.repository.ts    # OAuth 계정 (EncryptionService 사용)
│   ├── session.repository.ts
│   ├── verification.repository.ts
│   ├── login-attempt.repository.ts
│   ├── security-log.repository.ts
│   └── oauth-state.repository.ts
├── guards/
│   ├── jwt-auth.guard.ts        # @Public() 지원
│   ├── jwt-refresh.guard.ts
│   └── admin.guard.ts
├── interceptors/
│   └── last-active.interceptor.ts  # 글로벌 (APP_INTERCEPTOR)
├── processors/
│   └── account-purge.processor.ts  # 탈퇴 계정 정리
├── jobs/
│   └── account-purge.job.ts
└── strategies/
    ├── jwt.strategy.ts
    └── jwt-refresh.strategy.ts
```

**Todo 모듈:**

```
src/modules/todo/
├── todo.module.ts
├── todo.controller.ts
├── services/
│   └── todo.service.ts          # CRUD + 완료 + 정렬 + 큐 enqueue
├── repositories/
│   └── todo.repository.ts
├── types/
│   └── todo.types.ts
└── mappers/
    └── todo.mapper.ts
```

### 7.3 소셜 모듈 (Follow, Cheer, Nudge)

**공통 패턴 — 팔로우 관계 확인 후 동작:**

```typescript
// Service 내부 — 모든 소셜 기능 공통 패턴
async send[Action](senderId: string, receiverId: string, ...) {
  // 1. 팔로우 관계 확인
  const isFriend = await this.followService.isMutualFriend(senderId, receiverId);
  if (!isFriend) {
    throw BusinessExceptions.notFriends(receiverId);
  }

  // 2. 일일 제한 확인 (EntitlementService)
  const entitlement = await this.entitlementService.getFeatureLimitInTx(tx, senderId, Feature.XXX);
  this.entitlementService.enforceLimit(entitlement, todayCount, () =>
    BusinessExceptions.xxxLimitExceeded(todayCount, entitlement.dailyLimit),
  );

  // 3. 생성 + 비동기 큐 enqueue
  const result = await this.[feature]Repository.create({ ... });
  this.notificationQueueService.enqueueXxxSent({ ... });
  return result;
}
```

**API 엔드포인트:**

| 모듈 | 엔드포인트 | 설명 |
|------|-----------|------|
| Follow | `POST /v1/follows/:userId` | 팔로우 요청 |
| Follow | `DELETE /v1/follows/:userId` | 언팔로우 |
| Follow | `GET /v1/follows/followers` | 팔로워 목록 |
| Follow | `GET /v1/follows/following` | 팔로잉 목록 |
| Cheer | `POST /v1/cheers` | 응원 전송 (메시지 포함) |
| Nudge | `POST /v1/nudges` | 찌르기 전송 |

### 7.4 AI 모듈

```
POST /v1/ai/parse-todo
     │
     ▼
┌─────────────────────────────────────────────────┐
│  AiService                                       │
│  - Google Gemini API 호출                         │
│  - 토큰 최적화 프롬프트 (~200 tokens)              │
│  - 일일 사용량 제한 (FREE: 5회, PREMIUM: 100회)    │
└─────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────┐
│  응답: ParsedTodo                                │
│  - title, startDate, endDate, scheduledTime      │
│  - isAllDay                                      │
└─────────────────────────────────────────────────┘
```

**클라이언트 플로우**: AI 파싱 → 사용자 확인/수정 → `POST /v1/todos`로 생성

**사용량 제한:**

| 플랜 | 일일 제한 |
|------|----------|
| FREE | 5회 |
| PREMIUM | 100회 |

### 7.5 알림/스케줄러 (DB 기반 중복 방지)

**TodoReminderJob** — 크론 작업:

| 항목 | 값 |
|------|-----|
| 주기 | 매 10분 (`*/10 * * * *`) |
| 대상 | 예정 시간 50~60분 전 할 일 |
| 중복 방지 | DB 기반 (24시간 내 같은 todoId의 REMINDER 알림 확인) |

```typescript
// todo-reminder.job.ts — DB 기반 중복 방지 패턴
@Cron('*/10 * * * *')
async handleTodoReminder() {
  // 1. 대상 할 일 조회 (50~60분 전)
  const todosToNotify = await this.database.todo.findMany({ ... });

  // 2. 이미 알림 보낸 할 일 필터링 (24시간 내)
  const existingNotifications = await this.database.notification.findMany({
    where: {
      todoId: { in: todoIds },
      type: 'TODO_REMINDER',
      createdAt: { gte: twentyFourHoursAgo },
    },
  });
  const alreadyNotifiedIds = new Set(existingNotifications.map(n => n.todoId));

  // 3. 새로운 대상만 알림 발행
  const newTodosToNotify = todosToNotify.filter(
    todo => !alreadyNotifiedIds.has(todo.id)
  );
}
```

> **크론 작업에서 영속적 in-memory 상태(클래스 필드 Set/Map) 사용 금지** — 서버 재시작 시 상태 유실. 반드시 매 실행마다 DB 조회로 중복 판단. (DB 조회 결과를 임시 Set으로 변환하여 필터링하는 것은 허용)

---

## 8. 새 기능 추가 체크리스트

### 1단계: 스키마/모델 준비

- [ ] `prisma/schema.prisma`에 모델 추가
- [ ] `pnpm db:migrate` 실행
- [ ] `@aido/validators`에 Request/Response Zod 스키마 추가 ([validators.md](./validators.md))
- [ ] NestJS DTO 추가
- [ ] `pnpm build` 실행

### 2단계: API 모듈 구현

- [ ] `repositories/{name}.repository.ts` 생성 (tx 패턴 적용)
- [ ] `services/{name}.service.ts` 생성 (BusinessExceptions 사용)
- [ ] `{name}.controller.ts` 생성 (Swagger 문서화)
- [ ] `{name}.module.ts` 생성
- [ ] `types/{name}.types.ts` 생성 (필요시)
- [ ] `app.module.ts`에 모듈 import 추가

### 3단계: 에러 처리

- [ ] 필요한 BusinessExceptions 팩토리 메서드 추가
- [ ] 새 Unique Constraint가 있으면 constraintMap에 매핑 추가
- [ ] `@aido/errors`에 ErrorCode 추가

### 4단계: 큐/알림 (필요시)

- [ ] QueueService에 `enqueueXxx()` 메서드 추가
- [ ] Processor에 handler 메서드 추가
- [ ] Module에 `BullModule.registerQueue()` 등록
- [ ] `NotificationMessageBuilder`에 메시지 템플릿 추가 (알림인 경우)

### 5단계: 테스트

- [ ] Repository 단위 테스트 ([unit-test.md](./unit-test.md))
- [ ] Service 단위 테스트
- [ ] E2E 테스트 ([e2e-test.md](./e2e-test.md))

### 6단계: 검증

- [ ] `pnpm test` — 단위 테스트 통과
- [ ] `pnpm typecheck` — 타입 체크 통과
- [ ] `pnpm lint` — 린트 통과

---

**문서 버전**: 3.0.0
**최종 수정일**: 2026-04-05
