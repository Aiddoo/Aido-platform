# 서버 구조

Context·slice를 만들거나 옮길 때, 레이어 의존·포트·트랜잭션 소유를 정할 때 읽는다. 이름은 [이름 사전](conventions.md), 모델 규약은 [도메인 모델](domain-modeling.md), 공통 코드 규칙은 [루트 AGENTS](../../../AGENTS.md#공통-코드-규칙)에 있다.

## 흐름과 레이어

Aido 서버는 PostgreSQL 하나를 쓰는 모듈러 모놀리스다. Bounded Context가 업무를 소유하고, Context 안의 기능(slice) 하나가 Nest Module 하나다.

```text
HTTP → Guard/Interceptor → Controller → UseCase → Domain 행동 + Port
                                                              ↑ 구현
                                       Infrastructure → DB·pg-boss·cache·공급자
```

| 위치             | 소유하는 책임                                                                       |
| ---------------- | ----------------------------------------------------------------------------------- |
| `domain`         | 상태 전이, 값 검증·불변성, 순수 업무 판단(Entity·VO·도메인 서비스)                  |
| `application`    | UseCase 흐름·권한·트랜잭션 조정, Port(abstract class), Read Model, 문구 카탈로그 키 |
| `infrastructure` | ORM·pg-boss·cache·SDK I/O, 행 ↔ 도메인 변환, 공급자 wire 검증                       |
| `presentation`   | HTTP DTO 검증, DTO → Command 변환, 응답 매핑·문구, Swagger                          |
| slice 루트       | Module, `*.providers.ts`(포트 바인딩 + UseCase 조립), `*.public.ts`, `*.config.ts`  |
| `platform`       | Nest 실행 기술: database, jobs, events, http, logging, config, cache, lock, di      |
| `shared`         | 도메인 베이스 클래스·공용 식별자·시간, 공용 Port·`ApplicationException`·CursorPage  |

녹음 파일은 서버로 오지 않는다. 기기가 글자로 바꾸고 서버는 글자만 받으며 전사를 저장하지 않는다. 파일 업로드가 필요한 기능은 기기 처리와 글자 전송을 먼저 찾는다.

## 폴더 구조 (목표)

```text
apps/api/src/
  modules/<context>/
    <context>.module.ts                # slice Module 묶음만 import·export
    shared/                            # 같은 Context의 slice 2개 이상이 공유할 때만 (예: TodoId)
    <slice>/
      <context>-<slice>.module.ts
      <context>-<slice>.providers.ts   # 포트 바인딩 + UseCase 조립 (한 파일)
      <context>-<slice>.public.ts      # 다른 Context에 여는 유일한 문
      <context>-<slice>.config.ts      # (있을 때) registerAs + Zod env
      domain/          <noun>.aggregate.ts  <noun>.entity.ts  <noun>-id.vo.ts  <noun>.vo.ts
                       <noun>-<past-verb>.event.ts  <topic>.domain-service.ts  <slice>.constants.ts
      application/     use-cases/<verb>-<noun>.use-case.ts  ports/<noun>.repository.port.ts
                       ports/<noun>.reader.port.ts  read-models/<noun>.read-model.ts
                       messages/<topic>.messages.ts  <slice>.lock-keys.ts  <slice>.log-events.ts
                       <slice>.alerts.ts  <slice>.errors.ts
      infrastructure/  persistence/drizzle-<noun>.repository.ts  drizzle-<noun>.reader.ts  <noun>-row.mapper.ts
                       adapters/<vendor>-<capability>.adapter.ts  <vendor>.wire.ts  <vendor>-outbound.policy.ts
                       jobs/<job>.queue.ts  <job>.processor.ts  <job>.scheduler.ts
                       cache/<noun>.cache.ts  <noun>.keyspace.ts  event-handlers/<reaction>.event-handler.ts
      presentation/    http/v1/<noun>.controller.ts  <noun>.dto.ts  <noun>-response.mapper.ts
                       http/v2/…  (출시 앱 호환 때문에 계약이 갈라질 때만)
  platform/  shared/{domain,application}/
```

- slice 기준은 "Aggregate Root 하나 = slice 하나"다. 필요한 파일만 만든다.
- 버전은 HTTP 경계(`presentation/http/v<n>/`, `@aido/api/contracts/<resource>/v<n>/`)에만 둔다. Application·Domain에는 버전이 없다.
- 새 slice는 생성기(`pnpm gen:api-slice`)로 시작한다. 생성기가 없는 동안에는 위 템플릿을 손으로 따른다.
- AppModule은 `<context>.module.ts`(`<Context>Module`)만 import한다. slice Module을 AppModule에 직접 넣지 않는다. 생성기는 Context Module이 없으면 만들고, 있으면 새 slice Module을 그 imports·exports에 더한다.
- 프레젠테이션은 계약을 `@aido/api/contracts/<aggregate>` 하위 경로로 import한다. 서버 테스트 별칭(`apps/api/vitest.config.ts`)도 같은 하위 경로를 해석한다.

| Context       | slice                                                         |
| ------------- | ------------------------------------------------------------- |
| identity      | `auth`, `users`, `preferences`                                |
| access        | `entitlements`, `quotas`                                      |
| billing       | `subscriptions`, `premium-grants`                             |
| planning      | `todos`, `todo-series`, `categories` (+ `shared/`)            |
| notes         | `memos`                                                       |
| engagement    | `comments`                                                    |
| social        | `friends`, `blocks`, `cheers`, `nudges`, `invites`, `reports` |
| notification  | `inbox`, `push`, `email`, `reminders`, `retention`            |
| insights      | `daily-completions`, `weekly-achievements`                    |
| ai-assistance | `generation`, `parsing`, `planning`, `reports`, `suggestions` |
| voice         | `voice-notes`, `action-plans`                                 |
| weather       | `forecasts`, `locations`                                      |
| operations    | `broadcasts`, `admin-notices`, `metrics`                      |
| app-config    | `app-versions`, `feature-discovery`                           |
| support       | `inquiries`                                                   |

slice 목록은 각 Context를 옮길 때 확정한다.

## 의존 규칙과 강제

```text
presentation → application → domain        infrastructure → application(ports) / domain
다른 Context → <context>-<slice>.public.ts 만         shared/* → 어떤 module도 모름
```

| 규칙                                                                                             | 강제                                                             |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Domain은 Nest·ORM·SDK·`@aido/api` 계약을 모른다. `@aido/api/vocabulary`·`/errors`만 허용         | oxlint `no-restricted-imports` overrides                         |
| Application은 infrastructure·presentation·SDK·`@aido/api` 루트와 `/contracts`·`/common`을 모른다 | 같음                                                             |
| 다른 Context는 `*.public.ts`로만 import한다                                                      | dependency-cruiser                                               |
| 파일·Module 순환 금지, `forwardRef(` 0건                                                         | `import/no-cycle` + dependency-cruiser `no-circular` + 관례 검사 |
| 폴더·파일 접미사. 역할 접미사는 사전의 하나만(`.spec`은 그 뒤에만)                               | ls-lint + 관례 검사(`ROLE_SUFFIXES`)                             |
| 안 쓰는 파일·export·의존성                                                                       | knip                                                             |

- 양방향 Module 의존이 필요해 보이면 소유 Context가 좁은 Port를 public으로 열고, 반대 방향은 [이벤트](jobs-and-events.md)로 바꾼다.
- 포트가 abstract class라 런타임 import가 생긴다. ESM에서는 순환이 부팅 실패로 드러나므로 앱 부팅 E2E(Health)로 확인한다.
- public에는 실제 소비되는 value·type만 명시 export한다. 내부 UseCase·구현 Repository·테스트 helper를 내보내지 않는다.

## Application 규약

- **UseCase**: Nest decorator 없는 순수 클래스, `execute(command)` 하나. 생성자 객체로 의존성을 받아 `readonly #dependencies`에 둔다. 의존성 타입은 `Pick<Port, "…">`로 좁힌다. 반환은 Entity 또는 Read Model이고 응답 문구·계약 타입은 presentation 매퍼가 만든다.
- **Port**: abstract class가 포트이자 DI 토큰이다. Symbol 토큰·`@Inject(TOKEN)`·interface와 token 짝을 쓰지 않는다. 이름과 타입은 앱의 말로 짓는다.
- **조립**: `platform/di/provide-use-case.ts`의 `provideUseCase(UseCase, { key: PortClass })`가 키 누락·토큰 타입 불일치를 컴파일 오류로 만든다. 단언은 helper 안 1곳만 이유 주석과 함께 둔다.

```ts
// modules/notes/memos/notes-memos.providers.ts (발췌)
export const NOTES_MEMOS_PROVIDERS = [
  { provide: MemoRepositoryPort, useClass: DrizzleMemoRepository },
  provideUseCase(CreateMemoUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    memoRepository: MemoRepositoryPort,
    clock: ClockPort,
    logger: loggerFor(CreateMemoUseCase),
  }),
] satisfies Provider[];
```

- **Clock**: `ClockPort.now(): Temporal.Instant`(운영 `SystemClock`, 테스트 `FixedClock`). Domain·UseCase에서 `new Date()`·`Date.now()`를 쓰지 않는다.
- **페이지네이션**: Application은 `CursorPage<TItem, TCursor>`와 순수 함수 `toCursorPage` 하나를 쓴다. 클래스·DI로 감싸지 않는다.

## 트랜잭션과 외부 작업

- 경계는 `UnitOfWorkPort.run`이고 Repository·Reader가 CLS의 활성 트랜잭션을 읽는다. tx를 인자로 넘기지 않는다.
- 같은 사용자의 상태를 여러 요청이 바꾸는 흐름(한도·보상·구독)은 UoW 안에서 `MutationLockPort.acquire`로 잠그고 최신 상태를 다시 읽는다. 잠금 키는 slice의 `<slice>.lock-keys.ts`에 둔다(문자열 값은 운영 계약).
- Aggregate `save()`가 행의 여러 컬럼을 함께 쓰면, 그 Aggregate를 바꾸는 UseCase는 모두 같은 잠금을 잡은 뒤 읽는다. 하나라도 다른 키를 잡거나 잠그지 않으면 늦게 저장한 쪽이 먼저 저장한 변경을 덮어쓴다(예: `MemoLockKeys.existingMemo`).
- 외부 AI·푸시·메일 I/O는 트랜잭션 밖이다. 커밋 뒤 작업은 `AfterCommitPort`(캐시 정리 전용)다. 상태를 바꾸는 후속 작업은 [같은 트랜잭션 enqueue](jobs-and-events.md)다.

```text
필요한 외부 조회
UoW: 잠금 → 최신 자격·상태 확인 → 도메인 행동 → 저장 → 같은 트랜잭션 enqueue·publish
commit → 캐시 정리
```

현재 사례: [CreateTodoUseCase](../src/modules/planning/todos/application/use-cases/create-todo.use-case.ts)(정렬 잠금 아래 저장), [GenerateReportUseCase](../src/modules/ai-assistance/reports/application/use-cases/generate-report.use-case.ts)(AI 호출 전후로 자격 재확인), [ReconcilePushReceipts](../src/modules/notification/push/application/use-cases/reconcile-push-receipts.use-case.ts)(외부 조회 밖, 기록·토큰 비활성화 한 UoW).

## 교체 가능한 포트

새 어댑터는 "어댑터 파일 + factory 한 줄 + 포트 계약 테스트 통과"로 끝나야 한다. 그 밖이 바뀌면 포트 설계가 틀린 것이다. 공급자 이름은 어댑터 파일·클래스·`*.wire.ts`에만 쓴다.

| 포트                                           | 지금 어댑터                     | 바꿀 수 있는 것          | 고르는 곳                              |
| ---------------------------------------------- | ------------------------------- | ------------------------ | -------------------------------------- |
| `PushSenderPort`                               | Expo                            | Web Push, FCM/APNs 직접  | `NOTIFICATION_PUSH_PROVIDER` → factory |
| `EmailSenderPort`                              | `@nestjs/mail`(Resend), Log     | SES, Postmark, SMTP      | `EMAIL_PROVIDER`                       |
| `AdminNotifierPort`                            | Discord, Log                    | Slack, 이메일            | `ADMIN_NOTIFIER_PROVIDER`              |
| `StoreSubscriptionStatusReaderPort` + 번역기   | RevenueCat                      | 웹 결제(토스·Stripe)     | `StoreSubscriptionEvent` 판별 유니온   |
| `AiGeneratorPort`                              | AI SDK(Anthropic·Google·OpenAI) | 다른 모델·게이트웨이     | `AI_PROVIDER_ORDER`([AI](ai.md))       |
| `WeatherReportProviderPort` 등                 | KMA, WeatherKit                 | 다른 공급자              | Module                                 |
| `JobQueuePort`                                 | pg-boss                         | SQS·BullMQ               | `platform/jobs`                        |
| `DomainEventPublisherPort`                     | 구독자별 pg-boss 작업           | 아웃박스 + 브로커 릴레이 | `platform/events`                      |
| `CacheStorePort` + slice 의미 캐시 Port        | in-memory, Redis                | Valkey                   | `CACHE_TYPE`([확장](scaling.md))       |
| `MutationLockPort`                             | PG advisory lock                | Redis lock               | `platform/lock`                        |
| `ApplicationLoggerPort`                        | nestjs-pino                     | 다른 로거                | `platform/logging`                     |
| `OperationalAlertPort`·`ExceptionReporterPort` | Sentry                          | Datadog 등               | `platform/observability`               |
| Repository Port 전부                           | Drizzle                         | 다른 ORM                 | slice `*.providers.ts` 한 줄           |

외부 호출 규칙은 [외부 호출](outbound.md)에 있다.

## 서버가 계산할 것

판단·한도·집계·정합성·시각 계산은 서버, 표시·입력·문구(언어)·상호작용은 앱이다. 앱이 같은 판단을 다시 만들 값이 필요하면 응답 필드를 더한다(출시 앱 호환을 위해 추가만).

| 서버가 응답에 싣는다                               | 앱이 한다                      |
| -------------------------------------------------- | ------------------------------ |
| 권한·한도·남은 횟수·초기화 시각(`featureQuota`)    | 표시                           |
| 날짜별 완료 수·연속 기록·알림 목적지(`navigation`) | 그대로 그리기(재계산하지 않음) |
| 응답 순서(정렬 명시)                               | 받은 순서 유지                 |
| `ErrorCode`·`details.limit`                        | 코드별 현지화 문구             |
| 기간 숫자(`year`·`week`·`dateRange`)               | 언어별 기간 라벨               |

서버·앱이 함께 아는 상수(언어 목록, 리마인더 시간 범위, 반복 월말 기준 등)는 `@aido/api/vocabulary` 한 곳이다([이름 사전](conventions.md#공유-값은-한-곳에서-선언한다)).

## 전환 중

모든 Context가 slice 구조다. 레이어 lint·ls-lint·dependency-cruiser·`#` 검사는 `apps/api/src` 전체에 걸린다. 남은 Symbol 토큰은 각 Context 문서의 "전환 중" 절에 적는다.
