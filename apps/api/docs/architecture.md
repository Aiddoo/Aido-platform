# 서버 구조

Context·slice를 만들 때, 레이어 의존·공개 면·포트·트랜잭션 소유를 정할 때 읽는다. 이름은 [이름 사전](conventions.md), 모델 규약은 [도메인 모델](domain-modeling.md), 새 기능 순서는 [새 기능 추가](new-feature.md), 공통 코드 규칙은 [루트 AGENTS](../../../AGENTS.md#공통-코드-규칙)에 있다.

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

녹음 파일은 서버로 오지 않는다. 기기가 글자로 바꾸고 서버는 글자만 받으며 전사를 저장하지 않는다.

## 폴더 구조

`pnpm gen:api-slice`(turbo generator, `turbo/generators`)가 아래 뼈대와 계약·테스트 파일을 만들고 Context Module에 slice를 더한다. 쓰지 않는 파일은 지운다.

```text
apps/api/src/
  modules/<context>/
    <context>.module.ts                # slice Module 묶음만 import·export
    shared/                            # 같은 Context의 slice 2개 이상이 공유할 때만 (예: TodoId)
    <slice>/
      <context>-<slice>.module.ts
      <context>-<slice>.providers.ts   # 포트 바인딩 + UseCase 조립 (한 파일)
      <context>-<slice>.public.ts      # 다른 Context에 여는 문
      <context>-<slice>.config.ts      # (있을 때) defineConfig 설정
      domain/          <noun>.aggregate.ts  <noun>.entity.ts  <noun>-id.vo.ts  <noun>.vo.ts
                       <noun>-<past-verb>.event.ts  <topic>.domain-service.ts  <slice>.constants.ts
                       <slice>.errors.ts(불변식 DomainException)
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

- slice 기준은 "Aggregate Root 하나 = slice 하나"다.
- 버전은 HTTP 경계(`presentation/http/v<n>/`, `@aido/api/contracts/<resource>/v<n>/`)에만 둔다. Application·Domain에는 버전이 없다.
- AppModule은 `<context>.module.ts`(`<Context>Module`)만 import한다. slice Module을 AppModule에 직접 넣지 않는다.
- presentation은 계약을 `@aido/api/contracts/<resource>` 하위 경로로 import한다.

| Context       | slice                                                                       |
| ------------- | --------------------------------------------------------------------------- |
| identity      | `auth`, `users`, `preferences`                                              |
| access        | `entitlements`, `quotas`                                                    |
| billing       | `subscriptions`, `premium-grants` (+ `shared/`)                             |
| planning      | `todos`, `todo-series`, `categories` (+ `shared/`)                          |
| notes         | `memos`                                                                     |
| engagement    | `comments`                                                                  |
| social        | `friends`, `blocks`, `cheers`, `nudges`, `invites`, `reports` (+ `shared/`) |
| notification  | `inbox`, `push`, `email`, `reminders`, `retention`                          |
| insights      | `daily-completions`, `weekly-achievements` (+ `shared/`)                    |
| weather       | `forecasts`, `locations` (+ `shared/`)                                      |
| ai-assistance | `generation`, `parsing`, `planning`, `reports`, `suggestions` (+ `shared/`) |
| voice         | `voice-notes`, `action-plans`                                               |
| operations    | `broadcasts`, `admin-notices`, `metrics`                                    |
| app-config    | `app-versions`, `feature-discovery` (+ `shared/`)                           |
| support       | `inquiries`                                                                 |

## 의존 규칙과 강제

```text
presentation → application → domain        infrastructure → application(ports) / domain
다른 Context → *.public.ts 만               shared/* → 어떤 module도 모름
```

| 규칙                                                                             | 강제                                                       |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Domain은 Nest·ORM·SDK·platform을 모른다. `@aido/api`는 `/vocabulary`·`/errors`만 | oxlint `no-restricted-imports` overrides(`.oxlintrc.json`) |
| Application은 infrastructure·presentation·SDK·platform·계약을 모른다             | 같음                                                       |
| 다른 Context는 `*.public.ts`로만 import한다                                      | dependency-cruiser `cross-context-only-via-public`         |
| 파일·Module 순환 금지, `forwardRef(` 0건                                         | `import/no-cycle` + dependency-cruiser + 관례 검사         |
| 폴더·파일 접미사. 역할 접미사는 사전의 하나만(`.spec`은 그 뒤에만)               | ls-lint(`.ls-lint.yml`)                                    |
| 비공개 멤버는 `#`, 파라미터 프로퍼티 금지                                        | oxlint `typescript/parameter-properties` + 관례 검사       |
| 코드 예외는 `*.errors.ts`의 이름 있는 생성 함수에서만 만든다                     | oxlint `aido/no-inline-coded-exception`                    |
| 안 쓰는 파일·export·의존성 0                                                     | knip(`check:unused`)                                       |
| 재수출은 [공개 면](#공개-면과-재수출)의 진입 파일만. barrel `index.ts` 금지      | oxlint `oxc/no-barrel-file` + 관례 검사(`checkReExports`)  |

- 규칙은 모든 Context에 같은 세기로 걸린다. 예외 목록이나 "옮긴 Context만" 같은 단계 구분을 두지 않는다.
- 다른 Context의 테이블을 직접 읽거나 쓰지 않는다. 소유 Context가 public으로 연 조회·쓰기 포트를 쓴다(예: planning `planning-todo-queries.public.ts`의 `TodoScheduleReaderPort`, 댓글 수를 바꾸는 [TodoEngagementCounterPort](../src/modules/planning/todos/application/ports/todo-engagement-counter.port.ts)).
- 양방향 Module 의존이 필요해 보이면 소유 Context가 좁은 Port를 public으로 열고, 반대 방향은 [이벤트](jobs-and-events.md)로 바꾼다. 조회 포트만 묶은 Module(`PlanningTodoQueriesModule`)을 따로 두면 무거운 Module을 끌어오지 않는다.
- 포트가 abstract class라 런타임 import가 생긴다. ESM에서는 순환이 부팅 실패로 드러나므로 앱 부팅 E2E(Health)로 확인한다.

## 공개 면과 재수출

다른 코드가 import하는 진입 파일은 세 종류뿐이다. 나머지 파일은 정의한 파일에서 바로 import하고 `export … from`으로 다시 내보내지 않는다(barrel `index.ts` 금지).

| 진입 파일                                                | 규칙                                                                                                 |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| slice `<context>-<slice>.public.ts`                      | 다른 Context가 쓰는 Module·Port·이벤트 payload schema·SQL 조건만 이름을 적어 export. `export *` 금지 |
| `@aido/api` package exports 진입 파일                    | `packages/api/package.json` `exports`의 `.`·`/common`·`/errors`·`/vocabulary`·`/contracts/*` index   |
| Drizzle schema 묶음(`platform/database/schema/index.ts`) | drizzle-kit과 RQB가 schema 객체 하나를 요구해 `tables.schema.ts`가 Context별 schema를 모은다         |

- public에는 실제 소비되는 값·타입만 둔다. 내부 UseCase·구현 Repository·테스트 helper를 내보내지 않는다.
- 포트 파일이 도메인 타입이나 계약 타입을 다시 내보내지 않는다. 쓰는 쪽이 원래 파일을 import한다.

## Application 규약

- **UseCase**: Nest decorator 없는 순수 클래스, `execute(command)` 하나. 생성자 객체로 의존성을 받아 `readonly #dependencies`에 둔다. 의존성 타입은 `Pick<Port, "…">`로 좁힌다. 반환은 Entity 또는 Read Model이고 응답 문구·계약 타입은 presentation 매퍼가 만든다.
- **Port**: abstract class가 포트이자 DI 토큰이다. Symbol 토큰·`@Inject(TOKEN)`·interface와 token 짝, 옛 이름을 같은 인스턴스로 잇는 `useExisting` 별칭을 두지 않는다. Symbol 토큰은 업무 포트가 아닌 platform의 라이브러리 client(`DRIZZLE`·`PG_BOSS_CLIENT`·`REDIS_COMMAND_CLIENT`)에만 이유 주석과 함께 둔다.
- **조립**: [provideUseCase](../src/platform/di/provide-use-case.ts)`(UseCase, { key: PortClass })`가 키 누락·토큰 타입 불일치를 컴파일 오류로 만든다. 로거 자리는 `loggerFor(UseCase)`(Nest `Logger`, 실제 출력은 nestjs-pino)다. 단언은 helper 안 1곳만 이유 주석과 함께 둔다.

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
- **페이지네이션**: Application은 `shared/application/cursor-page.ts`의 `CursorPage<TItem, TCursor>`와 순수 함수 `toCursorPage` 하나를 쓴다. 클래스·DI로 감싸지 않는다.

## 트랜잭션과 외부 작업

- 경계는 `UnitOfWorkPort.run`이고 Repository·Reader가 CLS의 활성 트랜잭션을 읽는다. tx를 인자로 넘기지 않는다.
- 같은 사용자의 상태를 여러 요청이 바꾸는 흐름(한도·보상·구독)은 UoW 안에서 `MutationLockPort.acquire(keys)`(PostgreSQL advisory xact lock)로 잠그고 최신 상태를 다시 읽는다. 잠금 키는 slice의 `<slice>.lock-keys.ts`에 두고, 다른 Context와 같은 잠금을 잡아야 하면 소유 slice가 public으로 연다(문자열 값은 운영 계약).
- Aggregate `save()`가 행의 여러 컬럼을 함께 쓰면, 그 Aggregate를 바꾸는 UseCase는 모두 같은 잠금을 잡은 뒤 읽는다. 하나라도 다른 키를 잡거나 잠그지 않으면 늦게 저장한 쪽이 먼저 저장한 변경을 덮어쓴다(예: `MemoLockKeys.existingMemo`).
- 외부 AI·푸시·메일 I/O는 트랜잭션 밖이다. 커밋 뒤 작업은 `AfterCommitTaskRegistryPort.register`(캐시 정리 전용)다. 상태를 바꾸는 후속 작업은 [같은 트랜잭션 enqueue](jobs-and-events.md)다.

```text
필요한 외부 조회
UoW: 잠금 → 최신 자격·상태 확인 → 도메인 행동 → 저장 → 같은 트랜잭션 enqueue·publish
commit → 캐시 정리
```

사례: [CreateMemoUseCase](../src/modules/notes/memos/application/use-cases/create-memo.use-case.ts)(정렬 잠금 아래 한도 확인·저장), [CreateTodoUseCase](../src/modules/planning/todos/application/use-cases/create-todo.use-case.ts)(카테고리·정렬 잠금 아래 생성, 커밋 뒤 알림·캐시), [GenerateReportUseCase](../src/modules/ai-assistance/reports/application/use-cases/generate-report.use-case.ts)(AI 호출 전후로 자격 재확인), [ReconcilePushReceipts](../src/modules/notification/push/application/use-cases/reconcile-push-receipts.use-case.ts)(외부 조회 밖, 기록·토큰 비활성화 한 UoW).

## 교체 가능한 포트

새 어댑터는 "어댑터 파일 + 바인딩 한 줄 + 포트 계약 테스트 통과"로 끝나야 한다. 그 밖이 바뀌면 포트 설계가 틀린 것이다. 공급자 이름은 어댑터 파일·클래스·`*.wire.ts`에만 쓴다. 환경·설정에 따라 어댑터를 고르는 규칙은 [설정](configuration.md#공급자-선택)에 있다.

| 포트                                                      | 지금 어댑터                                         | 고르는 곳                                                            |
| --------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------- |
| `PushProviderPort`                                        | Expo(`ExpoPushSenderAdapter`)                       | `notification-push.providers.ts`                                     |
| `EmailSenderPort`                                         | `@nestjs/mail`(Resend), Log                         | `EMAIL_PROVIDER`                                                     |
| `AdminNotifierPort`                                       | Discord, Log                                        | `ADMIN_NOTIFIER_PROVIDER`                                            |
| `StoreSubscriptionStatusReaderPort` + 번역기              | RevenueCat                                          | `StoreSubscriptionEvent` 판별 유니온([결제](billing.md#공급자-경계)) |
| `WeatherReportProviderPort`·`WeatherForecastProviderPort` | WeatherKit, KMA                                     | `weather-forecasts.providers.ts`                                     |
| `AiGeneratorPort`                                         | AI SDK(Anthropic·Google·OpenAI 체인)                | `AI_PROVIDER_ORDER`([AI](ai.md))                                     |
| `JobQueuePort`                                            | pg-boss                                             | `platform/jobs`                                                      |
| `DomainEventPublisherPort`                                | 구독자별 pg-boss 작업(`FanOutDomainEventPublisher`) | `platform/events`                                                    |
| `CacheStorePort` + slice 의미 캐시 Port                   | lru-cache, Redis                                    | `CACHE_TYPE`([확장](scaling.md))                                     |
| `MutationLockPort`                                        | PostgreSQL advisory lock                            | `platform/database`                                                  |
| `OperationalAlertPort`·`ExceptionReporterPort`            | Sentry(운영), 로그(그 밖)                           | 배포 환경([관측](observability.md#환경별-어댑터))                    |
| Repository Port 전부                                      | Drizzle                                             | slice `*.providers.ts` 한 줄                                         |

외부 호출 규칙은 [외부 호출](outbound.md)에 있다.

## 서버가 계산할 것

판단·한도·집계·정합성·시각 계산은 서버, 표시·입력·문구(언어)·상호작용은 앱이다. 앱이 같은 판단을 다시 만들 값이 필요하면 응답 필드를 더한다(출시 앱 호환을 위해 추가만).

| 서버가 응답에 싣는다                                               | 앱이 한다                      |
| ------------------------------------------------------------------ | ------------------------------ |
| 권한·한도·남은 횟수·초기화 시각(`featureQuota`)                    | 표시                           |
| 날짜별 완료 수·연속 기록·알림 목적지(`navigation`)                 | 그대로 그리기(재계산하지 않음) |
| 날씨 브리핑의 영향받는 할 일·옮길 시각, 메모 AI의 반복 정규화 결과 | 서버 값 사용                   |
| 응답 순서(정렬 명시)                                               | 받은 순서 유지                 |
| `ErrorCode`·공개 `details`(한도 오류의 `details.limit` 포함)       | 코드별 현지화 문구             |
| 기간 숫자(`year`·`week`·`dateRange`)                               | 언어별 기간 라벨               |

서버·앱이 함께 아는 상수(언어 목록, 리마인더 시간 범위, 날씨 시간대 경계, 반복 월말 기준 등)는 `@aido/api/vocabulary` 한 곳이다([이름 사전](conventions.md#공유-값은-한-곳에서-선언한다)).
