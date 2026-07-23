# API 아키텍처 가이드

**Version**: 4.1.0 · **Last Updated**: 2026-07-23 · **Owner**: Aido Platform Team

> NestJS 기반 백엔드 API의 전체 아키텍처 · 에러 처리 · BullMQ 큐 · 보안 · 공통 모듈

## 관련 문서

| 문서 | 내용 |
|------|------|
| [AGENTS.md](../AGENTS.md) | API 앱 진입점 (기술 스택, 핵심 규칙, 문서 네비게이션) |
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

### 1.1 계층 다이어그램 (클린아키텍처 use-case 표준 — 전 모듈)

> **전 모듈**(auth 포함)이 클린아키텍처 4계층(domain/application/infrastructure/presentation) + Facade + Ports/Adapters + 무버스 `@Injectable` use-case 표준을 따른다. 참조 구현: **todo**. 상세 계층·의존성 규칙은 §1.4.

```
HTTP Request
     ↓
Middleware (CORS)
     ↓
Guard (JwtAuthGuard → ThrottlerGuard → AdminGuard)   ── @Public()로 인증 스킵
     ↓
Controller (presentation/)  ── HTTP 요청/응답, DTO 검증, Swagger. Facade만 주입
     ↓
Facade (application/facades/)  ── use-case에 한 줄 위임. 공개 시그니처 = 모듈 공개 계약
     ↓
UseCase (application/use-cases|queries/)  ── @Injectable, 단일 execute(input)
     │  · 포트(Symbol 토큰 인터페이스)에만 의존
     │  · UNIT_OF_WORK.run(async () => ...) — 리포지토리가 CLS에서 활성 TX를 읽음
     │  · 규칙 위반은 ApplicationException(ErrorCode)
     ↓                                          ↓ 도메인 이벤트 (커밋 후)
Domain (애그리게잇·VO·정책·이벤트)          DOMAIN_EVENT_PUBLISHER.publishAll()
     │  · 불변식 위반은 DomainException           → EventEmitter2 → @OnEvent 핸들러(부수효과)
     ↓
Adapter (infrastructure/adapters/)  ── 포트 구현. Prisma 저장소·벤더 SDK·크로스모듈 위임
     ↓
Repository → DatabaseService (Prisma) → PostgreSQL

     ── 내구성 부수효과 (커밋 후 enqueue) ──
UseCase/Adapter → QueueService.enqueueXxx() → BullMQ Queue → Processor → Provider(Expo 등)
   · 3회 재시도, exponential backoff (1s → 2s → 4s)
```

### 1.2 의존성 방향 규칙

의존성 방향은 §1.4의 클린아키텍처 규칙(안쪽으로만: presentation → application → domain, infrastructure는 포트로 역전)을 따르며 `pnpm lint:boundaries`가 기계적으로 강제한다. 상세 표는 §1.4 참조.

| 방향 | 허용 | 비고 |
|------|------|------|
| Controller → Facade | ✅ | 컨트롤러의 유일한 주입 지점 |
| Facade → use-case | ✅ | 한 줄 위임 |
| application → domain / 포트 | ✅ | use-case가 도메인·포트 사용 |
| infrastructure → application 포트 | ✅ | 어댑터가 포트 구현 |
| domain → application/infrastructure/@nestjs/DB | ❌ | 도메인은 프레임워크 제로 의존 |
| application → Prisma 타입/타 모듈 내부 | ❌ | 포트·CLS UnitOfWork로 역전 |
| 외부 모듈 → 이 모듈 내부 깊은 경로 | ❌ | 배럴(index)의 Facade만 |

### 1.3 디렉토리 구조

```
apps/api/
├── prisma/
│   ├── schema.prisma           # 데이터베이스 스키마
│   └── migrations/             # 마이그레이션 파일
├── src/
│   ├── main.ts                 # 애플리케이션 진입점
│   ├── app.module.ts           # 루트 모듈
│   ├── shared/                 # 공통 인프라·유틸 (4계층, @/shared/* 별칭)
│   │   ├── domain/             # 공유 VO·날짜·도메인 예외(DomainException)·프롬프트
│   │   ├── application/        # 공유 포트·exceptions(ApplicationException)·pagination·entitlement·utils
│   │   ├── infrastructure/     # database·cache·redis·lock·encryption·throttle·events·bullmq·dedup·http·jose·config·logging·filters(GlobalExceptionFilter)
│   │   └── presentation/       # interceptors(ResponseTransform)·swagger·decorators·dtos
│   ├── todo/                   # 할 일 — 클린아키텍처 참조 구현 (§1.4)
│   │   ├── domain/             #   애그리게잇·VO·이벤트·도메인 서비스
│   │   ├── application/        #   포트·facade·use-case(쓰기)·queries(읽기)·@OnEvent 구독자
│   │   ├── infrastructure/     #   어댑터 (포트 구현)·행 repository·mapper
│   │   └── presentation/       #   controller·dtos
│   │   ── 나머지 도메인 모듈도 동일한 4계층 구조 (전 모듈 클린아키) ──
│   ├── admin/                  # 관리자 기능
│   ├── admin-notification/     # 관리자 알림 (Discord 등)
│   ├── ai/                     # AI 자연어 파싱 (Gemini)
│   ├── ai-report/              # AI 주간/월간 리포트
│   ├── ai-suggestion/          # AI 반복 제안
│   ├── auth/                   # 인증 (JWT, OAuth 4사)
│   ├── cheer/                  # 응원 메시지
│   ├── daily-completion/       # 일일 완료 통계
│   ├── email/                  # 이메일 발송
│   ├── follow/                 # 팔로우 관계
│   ├── health/                 # 헬스체크
│   ├── inquiry/                # 문의
│   ├── memo/                   # 메모 (→ 할 일 변환)
│   ├── notification/           # 알림 (BullMQ + 푸시)
│   ├── nudge/                  # 찌르기
│   ├── retention/              # 리텐션 캠페인 (백그라운드, presentation 없음)
│   ├── scheduler/              # 스케줄러 (리마인더)
│   ├── subscription/           # 구독/결제
│   ├── todo-category/          # 할 일 카테고리
│   ├── user-settings/          # 사용자 설정/프로필
│   ├── weather/                # 날씨 예보/부가정보 (KMA·에어코리아·KASI)
│   └── weekly-achievement/     # 주간 달성 통계
└── test/
    ├── e2e/                    # E2E 테스트
    ├── integration/            # 통합 테스트
    ├── mocks/                  # 테스트 Mock
    └── setup/                  # 테스트 설정
```

---

### 1.4 클린아키텍처 모듈 (Use-case + DDD) — 전 모듈 표준

**전 모듈**(auth 포함)이 이 표준으로 전환 완료됐다. **참조 구현은 todo 모듈** — 구조·패턴이 모호하면 todo를 따른다.
**@nestjs/cqrs는 사용하지 않는다** — CommandBus/QueryBus/EventBus/CqrsModule 금지. 유스케이스는 plain `@Injectable()` use-case 클래스, 부수효과는 EventEmitter2 기반 도메인 이벤트로 처리한다.
코드 작성 규칙 상세: [api-conventions.md §9](./api-conventions.md#9-클린아키텍처-모듈-규칙)

```
HTTP Request
     ↓
Controller ── Facade만 주입. DTO→Input 매핑, 날짜·타임존 파싱만 담당
     ↓
Facade (application/facades/) ── use-case들을 주입해 한 줄 위임.
     │                            공개 시그니처가 모듈의 공개 계약
     ↓
Application: use-case (엔드포인트당 1개, SRP)
     │  · plain @Injectable() 클래스 — 단일 async execute(input): Promise<R>
     │  · 포트(Symbol 토큰 인터페이스)에만 의존 — 8종 (repo 쓰기/읽기,
     │    category-ownership, cache, friend, streak, notification, reminder)
     │  · UNIT_OF_WORK.run(async () => ...) — 콜백 무인자. 리포지토리가 CLS에서
     │    활성 TX를 직접 읽음 (tx 핸들 계층 전달 없음, 전파는 Required)
     │  · load→mutate→write는 TX 안에서 (동시 수정 레이스 창 축소)
     │  · ApplicationException(ErrorCode)으로 유스케이스 규칙 위반 표현
     │  · 커밋 후 DOMAIN_EVENT_PUBLISHER.publishAll(pullDomainEvents())
     ↓
Domain: 애그리게잇 · 자식 엔티티 · VO · 도메인 서비스/정책 · 도메인 이벤트
     │  · 불변식 위반은 DomainException
     │  · props는 VO로 저장 (TodoSchedule — 날짜 불변식이 타입 수준 보장)
     │  · 하위 항목은 TodoItem 자식 엔티티 — 개수 한도·존재·제목 불변식을
     │    애그리게잇 행동 메서드(planItemAddition/updateItem/removeItem/
     │    validateItemsReorder)가 소유
     │  · 생성은 Todo.planCreation() (birth 불변식·기본값의 단일 지점 —
     │    id가 autoincrement라 팩토리 대신 계획 패턴)
     │  · 판단 규칙은 도메인 정책 함수 (completion-policy, reorder-position,
     │    expand-recurring-dates — 전부 순수 함수)
     │  · 상태 전이 메서드에서 raise(event) 적립 → use-case가 TX 커밋 후
     │    DOMAIN_EVENT_PUBLISHER.publishAll(pullDomainEvents())
     ↓
Infrastructure: 어댑터 (포트 구현)
     │  · PrismaTodo{Read}Repository → persistence/의 행 DAO(TodoRowRepository)에
     │    위임 + 도메인/응답 매핑 (reconstitute는 불변식 재검증 없음)
     │  · 크로스모듈 어댑터 → 타 모듈 서비스에 thin delegation
     │  · 페이로드 계약(알림 등)은 todo 포트가 소유, 어댑터가 구조 매핑
     ↓
TodoRowRepository (행 DAO) → DatabaseService (Prisma) → PostgreSQL

     ── 부수효과 (커밋 후, EventEmitter2) ──
@OnEvent(TODO_EVENTS.X) ── TodoCreated/Updated/Rescheduled/Deleted → 리마인더 스케줄/취소
                        └─ TodoToggled → 리마인더 취소 + 스트릭 + 친구완료/마일스톤 큐
```

**도메인 이벤트 파이프라인** (use-case → EventEmitter2 → @OnEvent):

- `DomainEvent` 인터페이스는 `eventName` 라우팅 키를 보유 (`shared/domain/aggregate-root.ts`). 이벤트명 상수는 모듈 소유 — 예: `todo/domain/events/todo-event-names.ts`의 `TODO_EVENTS` (`"todo.created"` 등)
- 발행 포트는 `DOMAIN_EVENT_PUBLISHER` (`shared/application/ports/domain-event-publisher.port.ts`) — `@Global` `DomainEventsModule`이 제공, EventEmitter2 어댑터는 `shared/infrastructure/events/`
- 발행은 **반드시 트랜잭션 커밋 후** (`UNIT_OF_WORK`의 `run` 콜백 밖). TX 안에서는 `pullDomainEvents()`로 드레인만 한다
- EventEmitter2 `emit`은 **동기** — 퍼블리셔가 이벤트 단위 try/catch로 예외를 격리한다 (발행 실패가 호출자에 전파되지 않는 fire-and-forget 계약)
- 구독은 `application/events/`의 `@Injectable()` 클래스 + `@OnEvent(TODO_EVENTS.X)` — 핸들러 내부도 try/catch fire-and-forget + 로깅

**폴더 규칙** (쓰기·읽기 대칭 — read/write 저장소 분리와 미러링):

```
modules/todo/
├── domain/            entities/ (todo, todo-item) · value-objects/ · events/ (+ todo-event-names.ts) · services/
├── application/       ports/ (8종) · types.ts · facades/ (todo.facade.ts)
│                      · use-cases/<kebab>/<kebab>.use-case.ts(+spec) — 쓰기
│                      · queries/<kebab>/<kebab>.use-case.ts(+spec) — 읽기
│                      · events/ (5종 @OnEvent 부수효과 구독자)
├── infrastructure/    adapters/ (포트 구현 8종) · persistence/ (행 DAO·응답 매퍼·행 타입)
├── presentation/      todo.controller.ts · dtos/
├── todo.module.ts  index.ts (공개 API = Facade + DTO)
```

**의존성 방향 (클린아키텍처 모듈)** — `pnpm lint:boundaries`가 기계적으로 강제

| 방향 | 허용 여부 | 비고 |
|------|----------|------|
| Controller → Facade | ✅ | 컨트롤러가 주입하는 유일한 지점 — use-case/리포지토리 직접 주입 금지 |
| Facade → use-case | ✅ | 한 줄 위임 (로직 금지) |
| application → domain | ✅ | use-case가 애그리게잇/VO/도메인 서비스 사용 |
| application → 포트(인터페이스) | ✅ | `@Inject(SYMBOL_TOKEN)` |
| infrastructure → application 포트 | ✅ | 어댑터가 포트 구현 |
| infrastructure → 행 DAO/타 모듈 Facade | ✅ | 위임 전용 (쿼리 중복 금지) |
| domain → application/infrastructure/@nestjs/DB | ❌ | 도메인은 프레임워크 제로 의존 |
| application → Prisma 타입/타 모듈 내부 | ❌ | CLS 기반 UnitOfWork·포트로 역전 |
| 외부 모듈 → 이 모듈 내부 깊은 경로 | ❌ | 배럴(index)의 Facade 호출만 — 예: memo의 `TODO_CREATOR` 포트 → `TodoCreatorAdapter`가 `TodoFacade`에 위임 |
| domain/application/infrastructure에서 `as`/`!` | ❌ | `as`: `pnpm lint:no-cast` · `!`: Biome `noNonNullAssertion` |

> 두 게이트는 CI `lint:arch` 태스크로 실행된다(배포 차단 게이트). 경계는 dependency-cruiser
> (`.dependency-cruiser.cjs` — `src/<module>/` 구조에서 자동 유도, 모듈 목록 하드코딩 없음),
> `as` 단언은 `scripts/check-no-cast.mjs`(새 모듈 전환 시 `TARGET_DIRS`에 추가), `!` 단언은
> Biome `noNonNullAssertion`(biome.json override)이 담당한다.

**의도적 트레이드오프** (재검토 시점과 함께 기록):

| 결정 | 이유 | 재검토 시점 |
|------|------|------------|
| `reconstitute` 무검증 복원 | 가드 도입 이전 데이터도 복원은 성공해야 함 | 데이터 정합 백필 후 |
| `create()` 팩토리 대신 `planCreation()` 계획 패턴 | id가 DB autoincrement | id 전략을 UUID로 바꿀 때 |
| 행 단위 저장(필드별 update) — 컬렉션형 save(todo) 아님 | 동시 필드 쓰기 클로버 방지, Prisma partial update 적합 | 낙관적 잠금(version) 도입 시 |
| version 컬럼(낙관적 잠금) 미도입 | 스키마·충돌 에러 시맨틱 변경 = 클라 영향 | 충돌 빈도가 문제 될 때 (현재는 TX 감싸기로 창 축소) |
| 이벤트 아웃박스 없음 | 기존 fire-and-forget 큐 규칙과 일관 | 부수효과가 유실 불가 요건이 될 때 |
| TodoTitle을 props에 string으로 저장 | 매핑 노이즈 대비 이득 없음 (모든 쓰기 경로가 VO 게이트 통과) | 제목 규칙이 늘어날 때 |

**계약 안전장치**: `test/e2e/openapi-contract.e2e-spec.ts` 스냅샷이 전체 API 계약을 고정 —
마이그레이션 중 스냅샷 diff 0 = 클라이언트 영향 0.

### 1.5 표준 예외 (의도된 이탈 — 강제 금지)

전 모듈 클린아키 표준이 원칙이나, 아래는 **의도적으로 4계층/use-case 형태를 따르지 않는다.**
표준을 억지로 씌우면 불변식 없는 계층에 의식(ceremony)만 늘기 때문이다.

| 이탈 | 이유 |
|------|------|
| **scheduler** — Facade·use-case 없음, `application/strategies/` + `services/` 전략 기반 크론 오케스트레이터. 공개는 `scheduler/queue.ts` 서브엔트리(`.dependency-cruiser.cjs` PUBLIC_SUBENTRIES 화이트리스트) | 자기 불변식이 없고 타 모듈 Facade를 조합·스윕할 뿐. 4계층은 과함 |
| **presentation 없는 백그라운드 모듈** — `admin-notification`·`email`·`retention` | HTTP 진입점이 없는 큐/이벤트 소비 모듈 |
| **read-model / anemic 도메인** — `daily-completion`·`weekly-achievement`(플랫 모델)·`inquiry`·`ai`·`email`(VO/서비스만) | 애그리게잇 불변식이 없는 조회·변환·벤더 경계 모듈 |
| **auth `workflows/`·`services/` 내부 계층** — use-case는 얇은 위임, 실제 오케스트레이션은 `workflows/`(credential-auth·oauth·password), 세션/검증은 `services/` | 인증은 도메인 규모가 커 엔드포인트당 단일 use-case로는 응집이 깨짐. use-case 파일 자체는 표준대로 폴더당 1개(§7.2) |
| **infrastructure 계층의 `CacheService` 직접 사용** — 캐시 어댑터·`prisma-scheduler.reader`·`push-dispatcher.adapter` | 어댑터는 인프라 경계라 §5.3.2 포트 규칙 대상이 아님 |

> 큐/알림 페이로드 DTO는 도메인 이벤트가 아니므로 `domain/events/`가 아니라
> `application/types/`(subscription) 또는 `domain/types/`(admin-notification)에 둔다.

## 2. 에러 처리 체계

### 2.1 에러 흐름

```
예외 발생
  ├── ApplicationException / DomainException (모듈 코드가 던지는 타입)
  │     → 둘 다 ErrorCodedException(ErrorCode 보유). 필터가 BusinessException으로
  │       정규화해 errorCode + message + httpStatus 응답 생성
  │
  ├── BusinessException (필터의 canonical 에러 타입 + 공유 카탈로그)
  │     → 정의된 errorCode + message + httpStatus 그대로 반환
  │     → 신규 비즈니스 로직은 직접 던지지 않음(벤더 어댑터 극소수 예외)
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

> **모듈 코드는 `ApplicationException`(유스케이스 규칙 위반)·`DomainException`(도메인 불변식 위반)을 던진다.** 둘 다 `ErrorCode`를 보유하며, `GlobalExceptionFilter`가 이를 `BusinessException`으로 정규화한다. 같은 `errorCode`+`details`면 어느 경로든 **byte-identical HTTP 응답**을 만든다 — `BusinessException`은 필터의 내부 표현이자 공유 에러 카탈로그(P2002 매핑 등)일 뿐, 신규 로직에서 직접 던지지 않는다.

### 2.2 예외 계층: ApplicationException/DomainException + BusinessException 카탈로그

> **throw 표준**: 모듈 코드는 `ApplicationException`(응용 규칙)/`DomainException`(도메인 불변식)을 던진다. 둘 다 `ErrorCodedException`을 확장하고 `ErrorCode`를 보유한다. `GlobalExceptionFilter`가 이를 `BusinessException`으로 정규화해 HTTP 응답을 만든다(§2.3).
>
> **`BusinessException`/`BusinessExceptions`의 역할**: `HttpException`을 확장한 필터의 canonical 에러 타입 + 공유 에러 카탈로그(도메인별 정적 팩토리). Prisma P2002 constraintMap 매핑이 이 팩토리를 쓰고, 벤더 어댑터 2곳(weather KMA·ai Gemini)이 직접 던진다. **신규 비즈니스 로직에서 직접 던지지 않는다** — `ApplicationException`/`DomainException`(+`ErrorCode`)을 쓴다. `new HttpException()` 금지.

**위치**: `BusinessException` = `src/shared/application/exceptions/`, `ApplicationException` = `src/shared/domain/exceptions/application.exception.ts`, `DomainException` = `src/shared/domain/exceptions/domain.exception.ts`.

카탈로그 위치: `src/shared/application/exceptions/business-exception.service.ts`

```typescript
// BusinessException 클래스 (필터 내부 표현 — 신규 코드가 직접 인스턴스화하지 않음)
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
// 모듈 코드 throw 표준 — ApplicationException/DomainException(+ErrorCode)
throw new ApplicationException(ErrorCode.TODO_1201, { todoId });          // 유스케이스 규칙
throw new DomainException(ErrorCode.TODO_1210, { itemCount, limit });     // 도메인 불변식
// 필터가 위 예외를 아래 카탈로그의 errorCode 정의로 정규화해 HTTP 응답 생성
```

**공유 에러 카탈로그 — 도메인별 정적 팩토리 메서드 목록** (필터·P2002 매핑이 사용):

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

**위치**: `src/shared/infrastructure/filters/global-exception.filter.ts`

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
- use-case에서 `new ApplicationException(ErrorCode.X, details)`, 도메인 불변식은 `new DomainException(...)`로 예외 발생
- 새 Unique Constraint 추가 시 constraintMap에 매핑 등록
- QueueService `enqueueXxx()` 메서드로 비동기 부수효과 위임 (커밋 후)

**DON'T ❌**
- Controller에서 try-catch (GlobalExceptionFilter가 담당)
- `new HttpException()` 직접 사용, 신규 로직에서 `BusinessExceptions` 직접 던지기 (ApplicationException/DomainException 사용)
- 에러 응답 형식 직접 구성 (GlobalExceptionFilter가 담당)
- 리포지토리(어댑터)에서 비즈니스 예외 발생 (use-case/도메인이 담당)

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
    connection: redis,
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
// src/{name}/infrastructure/queue/{name}-queue.service.ts
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
// src/{name}/infrastructure/queue/{name}-queue.processor.ts
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
// src/{name}/infrastructure/jobs/{name}.job.ts
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

### 3.6 use-case에서 큐 사용 패턴

```typescript
// src/{name}/application/use-cases/create-xxx/create-xxx.use-case.ts
@Injectable()
export class CreateXxxUseCase {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
    @Inject(XXX_REPOSITORY) private readonly repository: XxxRepositoryPort,
    private readonly [feature]QueueService: [Feature]QueueService,
  ) {}

  async execute(input: CreateInput): Promise<Result> {
    // 1. 비즈니스 로직 (CLS 트랜잭션 — 리포지토리가 활성 TX를 읽음)
    const result = await this.uow.run(async () => {
      // ... 도메인 로드→변경→저장
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

**위치**: `src/notification/infrastructure/providers/` (포트/토큰: `src/notification/application/ports/push-provider.port.ts`)

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

**위치**: `src/auth/infrastructure/guards/`

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
      throw new ApplicationException(ErrorCode.AUTH_0101, {
        reason: err?.message || "Access token is missing or invalid",
      });
    }
    return user;
  }
}
```

**위치**: `src/auth/infrastructure/guards/jwt-auth.guard.ts`

### 4.3 LastActiveInterceptor (글로벌)

**위치**: `src/auth/presentation/interceptors/last-active.interceptor.ts`

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

**위치**: `src/auth/application/workflows/oauth.workflow.ts`

**Trusted vs Untrusted Provider:**

| 분류 | Provider | 이메일 검증 |
|------|----------|-----------|
| Trusted | Google, Apple | 이메일이 플랫폼 차원에서 검증됨 |
| Untrusted | Kakao, Naver | 이메일 검증 보장 안 됨 |

**자동연동 규칙:**

```
같은 이메일의 기존 사용자가 있을 때:
  ├── Trusted Provider + emailVerified → 자동 계정 연동 (Auto-Link)
  │   └── CLS 트랜잭션: Account 생성 + SecurityLog("OAUTH_AUTO_LINKED")
  │
  └── Untrusted Provider 또는 !emailVerified → 수동 연동 요구
      └── throw ApplicationException(SOCIAL_0206) + SecurityLog("OAUTH_LINK_REQUIRED")
```

```typescript
// oauth.workflow.ts — 핵심 로직 (uow.run = CLS 트랜잭션, 리포지토리가 활성 TX를 읽음)
private async handleEmailConflict(...) {
  const isTrusted = this.isTrustedProvider(provider);  // Google, Apple
  const isEmailVerified = options.emailVerified === true;

  if (isTrusted && isEmailVerified) {
    // Auto-link: 신뢰할 수 있는 제공자의 검증된 이메일
    await this.uow.run(async () => {
      await this.accountRepository.createOAuthAccount({ ... });
      await this.securityLogRepository.create({
        event: SECURITY_EVENT.OAUTH_AUTO_LINKED,
        metadata: { provider, autoLinked: true, reason: 'trusted_provider_verified_email' },
      });
    });
    return this.createSessionAndTokens(...);
  }

  // 수동 연동 필요
  throw new ApplicationException(ErrorCode.SOCIAL_0206, { provider, providerAccountId, email });
}
```

### 4.5 EncryptionService (AES-256-GCM)

**위치**: `src/shared/infrastructure/encryption/encryption.service.ts`

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
| `DatabaseModule` | `shared/infrastructure/database/` | `DatabaseService` (Prisma 래퍼) |
| `EncryptionModule` | `shared/infrastructure/encryption/` | `EncryptionService` |
| `CacheModule` | `shared/infrastructure/cache/` | `ICacheService`, `CacheService` |
| `LoggerModule` | `shared/infrastructure/logging/` | 글로벌 Logger |
| `ExceptionModule` | `shared/infrastructure/filters/` | `GlobalExceptionFilter` |
| `ResponseModule` | `shared/presentation/interceptors/` | `ResponseTransformInterceptor` |
| `PaginationModule` | `shared/application/pagination/` | `PaginationService` |
| `RedisModule` | `shared/infrastructure/redis/` | `REDIS_CLIENT` (BullMQ 전용), `REDIS_COMMAND_CLIENT` (명령용 fail-fast) |
| `LockModule` | `shared/infrastructure/lock/` | `ILockProvider` (Redis/InMemory Strategy) |
| `EntitlementModule` | `shared/application/entitlement/` | `EntitlementService` (플랜별 제한) |
| `DedupModule` | `shared/infrastructure/dedup/` | 알림 중복 방지 |
| `DomainEventsModule` | `shared/infrastructure/events/` | `DOMAIN_EVENT_PUBLISHER` (도메인 이벤트 발행 포트, EventEmitter2 어댑터) |

> `@Global()` 모듈은 `imports` 없이 어디서든 DI 가능.

### 5.1.1 Redis 연결 이원화 & 장애 격리 (포트 계약)

Redis 장애 시 API가 hang하지 않도록 연결을 용도별로 분리한다:

| 토큰 | 옵션 | 사용처 |
|------|------|--------|
| `REDIS_CLIENT` | `maxRetriesPerRequest: null`, 오프라인 큐 유지 | **BullMQ 전용** (블로킹 명령 호환). 다른 곳에 주입 금지 |
| `REDIS_COMMAND_CLIENT` | `enableOfflineQueue: false`, `commandTimeout` 1.5s, `maxRetriesPerRequest: 1` | 캐시/락/스로틀/dedup/푸시 레이트리미터/헬스 ping — 단절 시 즉시 reject |

포트별 장애 계약 (인터페이스 JSDoc에 명문화, 새 어댑터도 준수 필수):

| 포트 | 정책 | 장애 시 동작 |
|------|------|------------|
| `ICacheService` | fail-open | 읽기=미스 취급(→DB 폴백), 쓰기=무시. 계약 스펙: `cache-adapter.contract.ts` |
| `ILockProvider` | fail-closed | acquire=null(busy), release=무시(TTL 정리), isLocked=true |
| `IDedupProvider` | fail-open | 비중복 취급 (DB unique index가 최종 방어선) |
| `ThrottlerStorage` (`THROTTLER_STORAGE`) | fail-open | 요청 허용 |

관련 규칙:
- 에러 로그는 `RedisErrorLogSampler`(30초 윈도우당 1회 + suppressed 카운트)로 남긴다
- `JwtStrategy`는 세션 캐시 실패 시 DB로 폴백 — Redis 완전 다운이어도 인증 정상
- `JwtAuthGuard.handleRequest`는 비-HttpException(인프라 오류)을 401로 위장하지 않고 rethrow (401은 클라 강제 로그아웃 유발 — 5xx는 토큰 보존)
- `/health`의 `queues`는 절대 down(503)을 만들지 않는다 — Redis 다운 시 `up + degraded: true` (재시작으로 해결 불가하므로 ALB가 태스크를 죽이면 안 됨)
- 연결 종료는 `onApplicationShutdown`에서 quit(3s 타임아웃) → disconnect 폴백

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

**위치**: `src/shared/infrastructure/cache/`

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

### 5.3.1 조회 캐싱 표준 (Redis)

| 항목 | 규칙 |
|------|------|
| 적용 대상 | 적중률 높고 churn 낮은 조회에만 **선별 적용** — 전면 캐싱 금지 |
| 캐시 키 | `shared/infrastructure/cache/constants/cache-keys.ts`의 `CacheKeys`에서 중앙 관리. 신규 키는 `v1` 버전 세그먼트 포함 |
| TTL | 데이터 변동성 기반으로 결정 (`CacheKeys.TTL` 상수에 근거 주석과 함께 정의) |
| 무효화 | 쓰기 use-case에서 **명시적 호출** (도메인 이벤트가 없는 쓰기 경로 포함) 또는 `@OnEvent` 구독으로 처리 |
| 장애 계약 | fail-open (`ICacheService` 계약, §5.1.1) — 캐시 실패는 미스 취급, DB 폴백 |

### 5.3.2 모듈 캐시 포트 표준 (Pattern A — 필수)

**application 계층은 공유 `CacheService`/`CacheKeys`를 직접 주입하지 않는다.** 각 모듈은
자신의 캐시 포트(Symbol 토큰 인터페이스)에만 의존하고, 인프라 어댑터가 그 포트를
`ICacheService`(→`CacheService`/`CacheKeys`) 위에 구현한다. 이로써 캐시 키·TTL·직렬화는
어댑터가 소유하고, use-case는 도메인 캐시 시맨틱만 본다(교체 유연성·클린아키 경계).

```
application/ports/<module>-cache.port.ts     ── Symbol 토큰 + 시맨틱 메서드
infrastructure/adapters/<module>-cache.adapter.ts ── CacheService 위임(키/TTL 소유)
<module>.module.ts: { provide: X_CACHE, useClass: XCacheAdapter }
```

| 항목 | 규칙 |
|------|------|
| 적용 | 캐시를 쓰는 **모든** 모듈. 현재 포트: `TODO_CACHE`·`FOLLOW_CACHE`·`SUBSCRIPTION_CACHE`·`DAILY_COMPLETION_CACHE`·`TODO_CATEGORY_CACHE`·`AUTH_CACHE`·`NOTIFICATION_CACHE`·`USER_SETTINGS_CACHE`·`WEATHER_CACHE` |
| 금지 | 모듈 `application/`에서 `@/shared/infrastructure/cache/cache.service` 또는 `constants/cache-keys` 직접 import — `.dependency-cruiser.cjs`의 `application-no-shared-cache-service` 규칙이 기계적으로 차단 (CI `lint:arch`) |
| 예외 | **infrastructure 계층**(캐시 어댑터 자신, 크로스모듈 위임 어댑터, `prisma-scheduler.reader`, `push-dispatcher.adapter`)의 `CacheService` 직접 사용은 허용 — 어댑터가 인프라 경계이기 때문 |
| 크로스모듈 무효화 | 타 모듈 소유 키 무효화가 필요하면 자기 포트에 메서드로 노출하고 JSDoc에 크로스모듈임을 명시(예: notification의 `invalidateUserPreference`), 또는 도메인 이벤트 `@OnEvent`로 처리(예: daily-completion) |

### 5.4 TypedConfigService 래퍼

**위치**: `src/shared/infrastructure/config/services/config.service.ts`

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

> **Zod 스키마 기반 환경변수 검증**: `src/shared/infrastructure/config/schemas/` 하위에 `app.schema.ts`, `security.schema.ts`, `cache.schema.ts` 등에서 `z.object()`로 정의.

### 5.5 PaginationService (오프셋 + 커서)

**위치**: `src/shared/application/pagination/services/pagination.service.ts`

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
import { Timezone } from '@/shared/presentation/decorators';
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

**위치**: `src/shared/domain/date/`

```typescript
import { todayInTimezone, parseLocalDateTime, startOfDayInTimezone, midnightInTimezone } from '@/shared/domain/date';

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

**Auth 모듈** (4계층 클린아키. 도메인 규모상 application에 서비스 + use-case 혼재):

```
src/auth/
├── auth.module.ts
├── presentation/
│   ├── controllers/     # auth·oauth·session·account 컨트롤러
│   ├── interceptors/    # last-active (글로벌 APP_INTERCEPTOR)
│   ├── decorators/      # @Public() 등
│   └── dtos/
├── application/
│   ├── facades/         # auth·oauth·session·account 진입점 (컨트롤러의 유일 주입)
│   ├── workflows/       # credential-auth·oauth·password (실제 오케스트레이션)
│   ├── services/        # session·verification 서비스
│   ├── use-cases/       # 쓰기 유스케이스 (폴더당 1개, workflow에 위임)
│   ├── queries/         # 읽기 유스케이스 (get-current-user·list-* 등)
│   ├── ports/           # OAuth ID 제공자 포트 등 (Symbol 토큰)
│   ├── types/ · utils/
├── domain/
│   ├── services/ · value-objects/ · constants/
└── infrastructure/
    ├── guards/          # jwt-auth(@Public 지원)·jwt-refresh·admin
    ├── strategies/      # jwt·jwt-refresh (Passport)
    ├── oauth/           # 4사 provider 어댑터 + 토큰 verifier
    ├── persistence/     # user·account(암호화)·session·verification·security-log·oauth-state 저장소
    ├── adapters/        # 크로스모듈 포트 구현
    ├── queue/ · scheduler/   # account-purge processor/job
```

**Todo 모듈** (클린아키텍처 참조 구현):

```
src/todo/
├── todo.module.ts
├── presentation/
│   ├── (todo.controller.ts) · dtos/
├── application/
│   ├── facades/         # TodoFacade — 컨트롤러의 유일한 주입 지점
│   ├── use-cases/       # 쓰기 (엔드포인트당 1개)
│   ├── queries/         # 읽기
│   ├── ports/           # 저장소·캐시·크로스모듈 포트 (Symbol 토큰)
│   └── events/          # @OnEvent 도메인 이벤트 구독자
├── domain/
│   ├── entities/        # Todo 애그리게잇 + TodoItem 자식 엔티티
│   ├── value-objects/   # TodoSchedule 등
│   ├── services/        # 정책 함수 (completion·reorder·recurring — 순수)
│   └── events/          # TODO_EVENTS 이벤트명 + 이벤트 타입
└── infrastructure/
    ├── adapters/        # 포트 구현 (Prisma 저장소·크로스모듈 위임)
    └── persistence/     # 행 DAO (TodoRowRepository) + mapper
```

### 7.3 소셜 모듈 (Follow, Cheer, Nudge)

**공통 패턴 — 팔로우 관계 확인 후 동작:**

```typescript
// use-case.execute 내부 — 모든 소셜 기능 공통 패턴 (포트 의존)
async execute(input: { senderId: string; receiverId: string; ... }): Promise<Result> {
  // 1. 팔로우 관계 확인 (친구 관계는 포트로 조회)
  const isFriend = await this.friendPort.isMutualFriend(input.senderId, input.receiverId);
  if (!isFriend) {
    throw new ApplicationException(ErrorCode.FOLLOW_XXXX, { receiverId: input.receiverId });
  }

  // 2. 일일 제한 확인 (EntitlementService)
  const entitlement = await this.entitlementService.getFeatureLimit(input.senderId, Feature.XXX);
  this.entitlementService.enforceLimit(entitlement, todayCount);

  // 3. 커밋 후 비동기 큐 enqueue
  const result = await this.uow.run(async () => this.repository.create({ ... }));
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

### Durable job / infrastructure key 규칙

- 도메인은 `JOB_RUNTIME` 포트에만 의존하고 pg-boss/BullMQ 타입을 노출하지 않는다.
- 기본 운영 backend는 PostgreSQL이며 enqueue는 업무 트랜잭션과 같은 DB 트랜잭션에 참여한다.
- Redis rollback 시에도 같은 포트를 사용한다. 전환 중에는 PostgreSQL에만 쓰고 Redis worker를 drain한 뒤 연결을 제거한다.
- 런타임 DDL은 금지한다. pg-boss 공식 CLI migration이 성공한 뒤에만 API를 교체한다.
- 캐시·dedup·lock 논리 키는 `aido:v1:<bounded-context>:<resource>:<encoded-id>` 형식을 사용한다.
- 키 문자열을 호출부에서 이어 붙이지 않고 공용 `cacheKey`/`cachePattern` 또는 등록된 키 builder를 사용한다. TTL은 key builder와 함께 상수로 관리한다.
- 키 버전 변경은 cache miss만 유발해야 하며 DB가 항상 source of truth여야 한다.

---

## 8. 새 기능 추가 체크리스트

> 전 모듈 클린아키텍처 use-case 표준. 참조 구현: **todo**. 상세 코드 규칙: [api-conventions.md §9](./api-conventions.md#9-클린아키텍처-모듈-규칙).

### 1단계: 스키마/DTO 준비

- [ ] `prisma/schema.prisma`에 모델 추가 + `pnpm db:migrate`
- [ ] `@aido/validators`에 Request/Response Zod 스키마 + NestJS DTO 추가 ([validators.md](./validators.md)) + `pnpm build`
- [ ] `@aido/errors`에 필요한 ErrorCode 추가

### 2단계: Domain

- [ ] 애그리게잇 행동 메서드/자식 엔티티/VO/정책 함수/도메인 이벤트 작성
- [ ] 불변식 위반은 `DomainException`, 생성은 `planCreation`, 판단 규칙은 `domain/services/` 정책 함수(순수)

### 3단계: Application

- [ ] 포트(Symbol 토큰 인터페이스) 확장 — 저장소·캐시·크로스모듈 의존은 전부 포트로
- [ ] 쓰기는 `use-cases/<kebab>/<kebab>.use-case.ts`, 읽기는 `queries/<kebab>/<kebab>.use-case.ts` — `@Injectable()`, 단일 `execute(input)`
- [ ] 규칙 위반은 `new ApplicationException(ErrorCode.X, details)`
- [ ] 트랜잭션은 `UNIT_OF_WORK.run(async () => ...)`, 커밋 후 `DOMAIN_EVENT_PUBLISHER.publishAll(pullDomainEvents())`

### 4단계: Infrastructure

- [ ] 어댑터에 포트 구현 (Prisma 저장소는 행 DAO에 위임 + 도메인/응답 매핑, 벤더 SDK, BullMQ)
- [ ] 큐/알림 부수효과는 `QueueService.enqueueXxx()` (커밋 후 fire-and-forget)

### 5단계: Facade / Controller / Module

- [ ] Facade에 한 줄 위임 메서드 추가 (공개 시그니처 = 모듈 공개 계약)
- [ ] 컨트롤러는 Facade만 주입 + Swagger 문서화
- [ ] 모듈 배럴(`XxxUseCases`/`XxxQueryUseCases` 배열) 등록 확인

### 6단계: 테스트 + 검증

- [ ] use-case/query spec ([unit-test.md](./unit-test.md)) → 통합 → E2E ([e2e-test.md](./e2e-test.md))
- [ ] `pnpm test` · `pnpm typecheck` · `pnpm lint` 통과
- [ ] `pnpm lint:boundaries` · `pnpm lint:no-cast` 통과
- [ ] openapi 스냅샷 diff 0 (리팩터링 시 클라이언트 영향 0)

---

**문서 버전**: 4.0.0
**최종 수정일**: 2026-07-12
