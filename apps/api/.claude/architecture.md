# 서버 구조와 책임

모듈 경계나 상태·트랜잭션 소유를 바꿀 때 참고한다. 작성 형식은 [api-conventions.md](api-conventions.md), 저장소 구현은 [drizzle.md](drizzle.md)에 있다. 이 문서는 설계 기준과 실제 사례를 구분한다. 전체 전환 이력은 [migration.md](../../../docs/server/migration.md)가 소유한다.

## 의존성과 실행 흐름

Aido 서버는 PostgreSQL 기반 모듈러 모놀리스다. `modules/<context>`의 slice가 업무를 소유하고 Nest Module/factory provider가 경계를 조립한다.

```text
HTTP → Guard/Interceptor → Controller → endpoint UseCase
                                     → Domain 규칙 + Application Port
                                                        ↑ 구현
                                          Infrastructure → DB/pg-boss/cache/vendor
```

| 위치             | 소유하는 책임                                                  |
| ---------------- | -------------------------------------------------------------- |
| `domain`         | 상태 전이, 값의 검증·불변성, 순수 업무 판단                    |
| `application`    | 흐름·권한·UoW 조정, Port, read model, 메시지·프롬프트 조립     |
| `infrastructure` | ORM/SQL·pg-boss·cache·SDK I/O와 해당 표현의 변환               |
| `presentation`   | HTTP DTO 검증, 입력 변환, Swagger·상태·응답 매핑               |
| Context root     | Module, factory provider, 실제 소비하는 공개 capability        |
| `platform`       | DB transaction runtime, HTTP filter, Nest logging 등 실행 기술 |
| `shared`         | Context가 공통으로 쓰는 순수 규칙·Application 계약             |

Domain/Application은 Nest·ORM·vendor SDK·platform 구현에 의존하지 않는다. Domain은 Application/Infrastructure/Presentation을 모른다. 다른 Context의 구현 경로를 직접 import하지 않는다. 순수 `es-toolkit`, `ts-pattern`, 날짜 helper 등은 역할에 맞게 사용할 수 있으며 라이브러리 호출 자체를 새 wrapper로 감쌀 필요는 없다.

Controller는 UseCase를 직접 호출한다. 같은 요청을 한 번 더 전달하는 Facade는 추가하지 않는다. Application에서 실제 업무 조정이나 실패 격리를 제공하는 클래스는 전달 전용 클래스와 구분한다.

## 상태 모델과 조회 모델

Aggregate는 함께 일관성을 지켜야 하는 단건 상태와 행동이 있을 때 선택한다. 식별되는 모델은 Entity, 검증·동등성·불변성이 필요한 값은 VO, 입력으로 결과를 계산하는 규칙은 순수 함수/Policy로 표현할 수 있다. 모든 필드에 VO를 만들거나 모든 Entity를 Aggregate로 승격하지 않는다.

현재 사례:

- [Todo](../src/modules/planning/domain/aggregates/todos/todo.aggregate.ts)는 생성 계획·완료 등 업무 행동을 소유한다. DB 생성 ID를 얻기 전 `planCreation()`과 저장 상태의 `reconstitute()`를 구분한다.
- [Notification](../src/modules/notification/domain/aggregates/delivery/notification.aggregate.ts)은 읽음 상태·소유권·멱등 행동을 소유한다. 조회 컬럼과 transport action은 [NotificationRecord](../src/modules/notification/application/read-models/delivery/notification.read-model.ts)로 분리한다.
- [PushDevice](../src/modules/notification/domain/aggregates/delivery/push-device.aggregate.ts)는 기기별 알림 권한([PushPermission](../src/modules/notification/domain/value-objects/delivery/push-permission.vo.ts) VO)과 보고 시각을 소유한다. 플랫폼 판별·도달 가능 판단·건너뜀 사유·90일 stale 기준은 [push-device.policy.ts](../src/modules/notification/domain/policies/delivery/push-device.policy.ts)의 순수 함수다.
- [AiReport](../src/modules/ai-assistance/domain/entities/reports/ai-report.entity.ts)는 저장 결과의 불변 snapshot이다. 상태 전이가 없는데 형식적으로 AggregateRoot를 상속하지 않는다. 표시 label과 응답은 [Application read-model의 toAiReportView](../src/modules/ai-assistance/application/read-models/reports/ai-report.read-model.ts)가 조립한다.
- [Coordinate](../src/modules/weather/domain/value-objects/forecast/coordinate.vo.ts)의 전역 좌표 검증과 KMA의 한국 지원·투영 정책은 다르다. provider 정책/계산을 Domain 좌표에 섞지 않는다.

Aggregate 행동은 생성 factory(`planCreation`/`create`)와 저장 복원(`reconstitute`)을 나누고, 상태 전이 메서드는 실제로 바뀌었는지를 `boolean`으로 돌려준다. 이미 같은 상태면 아무것도 바꾸지 않고 `false`다([Nudge](../src/modules/social/domain/aggregates/nudges/nudge.aggregate.ts)의 `markRead`·`reply`). UseCase는 `false`일 때 저장·발송을 건너뛰어 재요청·재시도를 멱등으로 만든다.

`readonly`는 참조 재할당을 막을 뿐 `Date`·배열·원소를 깊게 고정하지 않는다. 상태 snapshot의 가변 값은 입력·출력에서 복사한다. 저장 복원은 생성 정책을 다시 실행하는 것과 구분한다.

조회·집계·렌더링은 read model/함수로 충분할 수 있다. batch claim/counter 같은 집합 원자성은 명명된 Port 뒤 DB 연산이 소유한다. 단건 Aggregate를 행마다 만들었다는 사실로 DB 동시성이 보장되지 않는다.

예외: 리마인더 스케줄러의 [DrizzleSchedulerReader](../src/modules/notification/infrastructure/persistence/reminders/drizzle-scheduler.reader.ts)는 발송 대상 판정을 위해 다른 Context의 테이블(할 일·설정·위치 등)을 한 SQL로 직접 읽는 배치 read model이다. 쓰기와 업무 판단은 소유 Context에 두고, 여기에는 명명된 조회 조건 타입(`WeatherReminderParams`·`WeatherReminderTodoQuery` 등)과 projection만 둔다.

## Port와 공개 capability

Port는 소비자가 필요한 외부 공급자·캐시·큐·cross-context capability·원자적 저장 동작을 표현한다. 기존 구현을 그대로 한 번 전달하기 위한 인터페이스나 DB 호출마다 Port를 추가하지 않는다. UseCase dependency는 실제 사용하는 메서드의 `Pick`으로 좁힐 수 있다.

현재 Weather는 v1(KMA)과 v2(WeatherKit)가 서로 다른 Port라 공급자 선택 Registry 없이 Module에서 직접 연결한다. 외부에는 [weather-forecast.public.ts](../src/modules/weather/weather-forecast.public.ts)의 read model과 최소 Reader만 공개한다. 내부 KMA token·resolver·ancillary provider를 함께 export하지 않는다.

```ts
// weather-forecast.module.ts의 실제 조립 발췌
{ provide: WEATHER_FORECAST_READER, useExisting: WeatherForecastReader },
{ provide: WEATHER_GRID_RESOLVER, useClass: KmaWeatherGridResolver },
```

`useExisting`은 이미 조립된 객체를 공개 token과 연결한다. 다른 Context의 Port를 소비자 Port token에 연결할 때는 `useExisting`이 두 타입을 검사하지 않으므로 반환 타입을 명시한 `useFactory`로 구조 호환을 컴파일러가 확인하게 한다(`REMINDER_WEATHER_REPORT_READER`). 필요 없는 forwarding reader를 하나 더 만들지 않는다. 구현 선택이 여러 개이고 실제 선택 정책이 있을 때만 Registry/Strategy가 유용하다.

Module은 `<context>-<slice>.module.ts`, 순수 Application 조립은 `<context>-<slice>-application.providers.ts`, 공개 경계는 `<context>-<slice>.public.ts`에 둔다. public에는 실제 소비되는 value/type만 명시 export한다. queue 작업자·Health 등 runtime 소비에는 별도 jobs public 경계가 쓰이기도 하며, 일반 업무 public과 같은 것으로 취급하지 않는다.

Module 순환과 type-only 참조를 구분한다. public barrel이 module을 재export하면 runtime import가 늘 수 있다. 양방향 Module import를 추가하기 전에 소유자의 좁은 capability와 조립 방향을 확인한다.

## 트랜잭션과 외부 작업

UoW 콜백은 transaction client를 인자로 받지 않는다. 같은 사용자의 상태를 여러 요청이 동시에 바꾸는 흐름(한도·보상·구독)은 UoW 안에서 `USER_MUTATION_LOCK`(identity의 사용자 행 잠금 Port, 소비 Context는 자기 이름의 token을 `useExisting`으로 연결)을 먼저 잡고 최신 상태를 다시 읽는다. Repository/Reader가 CLS의 활성 transaction을 읽는다. 필요한 동시성은 canonical lock·conditional update·constraint 등 실제 DB 수단으로 보장한다.

```text
필요한 외부 조회/생성
UoW: 잠금 → 최신 자격/상태 확인 → 업무 변경 → 저장
commit
후속 publish/enqueue/cache 정리
```

이는 모든 흐름의 고정 recipe가 아니다. 작업의 원자성·기존 격리 의미를 먼저 확인한다. 외부 AI·push·email I/O를 긴 DB transaction 안에서 실행하지 않는다. DB 안에서 수행하는 다른 Context의 업무 workflow는 같은 Required UoW에 참여할 수 있다.

실제 사례:

- [CreateTodo](../src/modules/planning/application/use-cases/todos/create-todo.use-case.ts)는 UoW/정렬 잠금 아래 저장하고 커밋 뒤 기존 생성 효과를 발행한다.
- [GenerateReport](../src/modules/ai-assistance/application/use-cases/reports/generate-report.use-case.ts)는 유료 자격을 AI 호출 전 확인하고, 외부 호출 후 account lock을 잡은 UoW에서 최신 자격·중복을 재확인해 저장한다. enqueue 시점의 cached 자격만으로 실행·저장을 허용하지 않는다.
- [ReconcilePushReceipts](../src/modules/notification/application/use-cases/delivery/reconcile-push-receipts.use-case.ts)는 외부 receipt 조회를 밖에서 하고 terminal 상태 기록·토큰 비활성화를 하나의 UoW로 묶는다. 비활성화 실패 시 retry 대상을 잃지 않도록 함께 rollback하며 cache 정리는 commit 뒤 격리한다.

부수효과 실패를 모두 같은 방식으로 처리하지 않는다. durable outbox, 기존 best-effort, 실패 전파·재시도 계약을 구분한다. callback mock이 성공한 결과는 native rollback/동시성의 증거가 아니다.

## 캐시·큐·시간·표시의 소유

- Application은 모듈 cache Port를 사용한다. Redis key, TTL, sentinel, pattern invalidation은 해당 Infrastructure keyspace가 소유하며 운영 키를 임의로 바꾸지 않는다.
- queue/job 이름, payload schema, retry/backoff, attempt 의미, enqueue 조건은 queue 소유 Context의 계약이다. 외부 입력은 신뢰하지 않으며 producer/consumer가 같은 schema를 사용한다. pg-boss는 at-least-once이므로 handler는 같은 payload의 재실행에 멱등이어야 한다(`singletonKey`, unique key, 상태 fence, 위의 boolean 전이).
- Date instant, DB DATE/calendar label, 사용자 timezone을 구분한다. 날짜 문자열을 process timezone의 instant로 바꾼 뒤 요일을 계산하지 않는다. DST 기간은 각 경계를 대상 zone에 다시 해석한다. 기존 shared date helper를 사용한다.
- locale별 사용자 copy·AI 지시문·response schema는 Application의 typed catalog나 Presentation이 소유한다. Domain 숫자 판단과 상태 규칙은 번역 문자열을 만들거나 파싱하지 않는다. 예: AI `application/prompts`, Notification `application/messages`, Email `application/services/email/email-message.factory.ts`·`application/templates/email`.
- Provider의 wire JSON/SDK 타입은 Infrastructure에서 변환한다. Application의 이메일 HTML처럼 순수 렌더링을 둔 기존 흐름은 I/O 구현과 구분한다. 관리자 알림은 벤더 중립 모델(severity·필드)만 Application이 만들고 Discord embed 같은 채널 표시는 어댑터가 렌더링한다. 이메일·관리자 알림 어댑터는 Module 조립과 `EMAIL_PROVIDER`·`ADMIN_NOTIFIER_PROVIDER` 설정 한 곳에서 고른다.

## 외부 호출 정책·계량·운영 경보

- 외부 호출은 `OutboundPolicyRegistry.get(spec)`의 `OutboundPolicy.execute((signal) => …, signal)` 안에서 한다(`platform/resilience`, cockatiel: bulkhead → 회로 → Aggressive timeout). 정책 값은 소유 모듈 infrastructure의 spec 상수(`ai-outbound.policies.ts`, `weather-outbound.policies.ts`, `expo-outbound.policy.ts`)다. 재시도 층은 한 호출에 하나다: 요청 안에서는 전송 계층 내장(AI SDK `maxRetries`, Expo SDK), 비동기는 pg-boss이고 cockatiel `retry`는 쓰지 않는다. 회로 로그는 `outbound.circuit.{opened,half-open,closed}`, 대기열 초과는 `outbound.bulkhead.rejected`다.
- 회로를 다는 기준: 호출마다 돈이 들거나, 요청 경로에서 대기 시간이 쌓이거나, 배치가 많은 호출로 퍼질 때. 상태는 프로세스 메모리(API 컨테이너 1대)다.
- 누적 사용량은 `USAGE_METER`(`UsageMeterPort`: `add`·`tryReserve`·`release`·`read`·`prune`, `OutboundUsage` 원자적 upsert)로 센다. 기간은 `usagePeriod`의 UTC 일·월이고 기준선 경보는 `crossedThresholds`로 기간당 한 번이다. 90일 지난 행은 `UsageRetentionJob`이 지운다.
- 사람이 확인할 상황은 `OPERATIONAL_ALERT`(`OperationalAlertPort.raise({ key, severity, message, tags, details })`, 절대 throw하지 않음) 하나로 올린다. 어댑터는 Sentry(fingerprint = key)이고 key 상수는 각 Context의 `application/observability/*-alerts.ts`다.

## 유료 기능과 권한

권한 주체는 FREE·PREMIUM(유효한 스토어 구독 또는 보상 기간)·ADMIN(모든 기능 무제한) 셋이다. 플랜 숫자는 `@aido/api/vocabulary`의 `PLAN_CATALOG` 한 곳에만 두고(출시 앱이 읽는 `PREMIUM_FEATURES`는 그 부분집합), 무료·프리미엄 판단은 [paid-access.policy](../src/modules/access/domain/policies/entitlement/paid-access.policy.ts)의 `hasPaidAccess`, 한도 판단은 [entitlement.policy](../src/modules/access/domain/policies/entitlement/entitlement.policy.ts) 하나다. ADMIN은 정책이 처리한다. 무제한으로 보이는 프리미엄 quota에 `fairUse.premium`이 있으면 서버는 그 상한으로 막고(`resolveQuotaLimit`), 출시 앱 응답은 표시 한도(null)를 그대로 보여 준다.

| 질문                         | 쓰는 곳                                                                                                                                               |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 이 기능을 쓸 수 있나·한도는  | `ENTITLEMENT_READER`의 `can`/`limitOf`(잠금 뒤 재확인은 `canInTx`/`limitOfInTx`), 거부는 `assertEntitled`/`assertEntitledInTx`(기능별 기존 ErrorCode) |
| 여러 사용자를 SQL로 고를 때  | `access-entitlement-sql.public`의 `premiumAccessCondition`/`freeAccessCondition`/`activeSubscriptionCondition`                                        |
| 프리미엄 출처·기간 표시(/me) | `PREMIUM_ACCESS_READER`(Billing). 권한 판단에는 쓰지 않는다                                                                                           |
| 돈이 드는 횟수(AI·녹음 정리) | `QUOTA_LEDGER`(`access-quota.public`)의 `reserve`→`commit`/`refund`, 표시는 `read`·`readSnapshot`이 주는 `featureQuota`                               |

사용 횟수 원장(`QuotaLedger`): AI 호출 전에 사용자 행 잠금 UoW 안에서 최신 권한으로 집행 한도(`resolveQuotaLimit`)를 다시 읽고 카운터를 올린 뒤 `QuotaCharge`(RESERVED)를 남긴다. 결과를 주면 COMMITTED, 실패·빈 결과면 REFUNDED로 조건부 전이해 환불은 정확히 한 번이다. `Idempotency-Key`가 같으면 COMMITTED는 `alreadyCommitted`(차감 없음), 처리 중이면 AI_1314, 환불된 키는 같은 행에서 다시 차감한다. 기간은 KST 달력 월(`QuotaWindow`)이고, AI_PLAN은 출시 앱과 같은 `User.aiUsageCount`·`aiUsageResetAt`, 나머지 계량기는 `QuotaUsage`(조건부 upsert)를 센다. 한도 오류는 `details: { charged: false, featureQuota }`다. 소유 Context가 세는 한도(응원·콕 찌르기 일간, 친구·카테고리 개수)도 한도 오류에 같은 상세를 싣고, `featureQuota`는 `ENTITLEMENT_READER.featureQuotaInTx`(센 사용량을 넘김)로 만든다. 프로세스가 죽어 남은 RESERVED는 `quota-abandoned-refund.v1` 잡(10분 주기)이 이어받기 기준 시간이 지난 것만 돌려준다.

유료 기능 추가 방법:

1. `@aido/api/vocabulary`의 `PLAN_CATALOG`(plan-catalog.constants.ts)에 kind(quota·resource·flag)와 free/premium 값을 추가한다. 출시 앱 /me가 아는 기능만 `PREMIUM_FEATURES`에 두고, 새 기능은 `PLAN_CATALOG`에만 더해 `GET /v1/entitlements`로 내보낸다. 앱만 막는 기능은 `clientOnly`.
2. 서버가 막는 flag면 [entitlement-guard](../src/modules/access/application/services/entitlement/entitlement-guard.ts)에 기존 ErrorCode를 연결하고 UseCase에서 `assertEntitled`를 호출한다. quota·resource는 `limitOf`로 한도를 읽고 사용량은 소유 Context가 센다.
3. `/me.entitlements` 계약(`premiumEntitlementsSchema`)에 키를 추가한다. 이전 앱은 모르는 키를 무시한다.
4. 사용량이 있는 quota는 `GetCurrentUser`에 `used`·`resetsAt`을 붙인다. 돈이 드는 횟수는 `QUOTA_METERS`에 계량기를 더하고 `QuotaLedger`로 센다.

다운그레이드는 데이터를 지우지 않는다. 한도를 넘긴 카테고리·친구는 그대로 두고 새로 만들기만 막는다(`CreateTodoCategory`·`SendFriendRequest`의 `count >= limit`). 사용량은 창(일·월) 단위로 계속 세고 한도만 바뀌므로, 이번 달 20회를 쓴 뒤 만료되면 다음 초기화까지 AI 파싱이 막힌다. 창 중간에 구독하면 바로 무제한이다.

만료 타임라인(UTC instant):

| 시점                                        | 판단                                                                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 보상 기간 `endsAt`                          | 이 시각부터 프리미엄 아님(24시간 = 1일, UTC 달력). 쌓아 둔 다음 기간은 앞 기간 끝에 빈틈 없이 이어진다                                      |
| 스토어 `expiresAt`(자동 갱신 중)            | 갱신 웹훅을 기다리며 3시간(`STORE_RENEWAL_GRACE_MS`)까지 프리미엄. 그 뒤 쌓아 둔 보상이 시작된다                                            |
| 스토어 `expiresAt`(취소함)                  | 이 시각에 끝난다                                                                                                                            |
| 스토어 결제 유예 `gracePeriodEndsAt`        | 결제 실패(BILLING_ISSUE) 뒤 스토어가 재시도하는 동안(최대 16·30일) 취소 상태여도 이 시각까지 프리미엄. 규칙은 `storeEntitlementEndsAt` 하나 |
| 경계 직후 요청                              | Access 캐시는 기한을 함께 저장해 TTL 안에서도 경계를 넘기지 않고, /me 프로필 캐시 TTL은 다음 경계까지로 줄인다                              |
| 정리 작업(`premium-grant-sweep`, 10분 주기) | 끝난 보상을 닫고, 만료 웹훅을 잃어 ACTIVE로 남은 projection을 다시 계산해 FREE로 저장한다. 그 전에도 판단은 위 규칙을 따른다                |

## 댓글 읽기 모델

댓글은 `parentId`·`replyCount`로 root와 답글을 구분한다(`path`·`depth`·`rootId` 열은 1.14.2에서 제거). overview/conversation은 변경이 잦고 viewer 상태·cursor 문맥이 있어 Redis 공유 payload를 쓰지 않는다. [DrizzleTodoCommentReader](../src/modules/engagement/infrastructure/persistence/comments/drizzle-todo-comment.reader.ts)가 root keyset을 SQL로 읽고 page 단위 like를 합치며, `application/presenters/comments/v1`·`v2`가 응답을 조립한다.

상세 조회수는 unique key로 멱등 기록하며 별도 기록 endpoint를 만들지 않는다. 삭제된 root는 살아 있는 답글이 있으면(`replyCount > 0`) 묘비로 남는다. 서명 cursor는 todo/sort/thread/scope를 묶는다. 변경 시 UseCase·reader·presenter와 구 앱/HTTP 계약을 함께 확인한다.

## 검증과 현재 전환 범위

Module·파일 순환은 만들지 않는다. `import/no-cycle`(Oxlint)이 import 순환을 막고, Nest `forwardRef`로 순환을 덮지 않는다. Oxlint import/cycle 규칙은 일부 기계적 경계를, 타입 검사는 계약 연결을 확인한다. 상태 소유·추상화 가치·실제 Module 조립·transaction은 코드 검토와 적절한 실행 증거가 필요하다. 새 소스 파싱 검사나 중복 architecture test를 기본으로 추가하지 않는다.

Context별 현재 구현과 실제 검증 범위는 [전환 기록](../../../docs/server/migration.md)에서 확인한다. 계획된 경로를 현재 경로로 링크하거나 회귀 검증을 운영 배포 완료로 표현하지 않는다. 변경 위험에 맞는 검증은 [testing-guide.md](testing-guide.md)에서 선택한다.
