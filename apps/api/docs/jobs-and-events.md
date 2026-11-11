# 작업과 이벤트 (pg-boss·도메인 이벤트·크론)

큐·스케줄·도메인 이벤트 구독을 만들거나 바꿀 때, 배포 중 작업 유실을 판단할 때 읽는다. 푸시 발송 큐의 세부는 [푸시 알림](push-notifications.md#큐와-작업-key)에 있다.

## 판단: 어떤 방식으로 보내는가

문제는 EventEmitter가 아니라 내구성 없는 전달로 업무 상태를 바꾸는 것이다.

| 반응                                           | 방식                                                                                                |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 같은 Context 반응(할 일 변경 → 리마인더 예약)  | 이벤트 없이 UseCase가 같은 트랜잭션에서 포트를 직접 호출(`TodoReminderSchedulerPort`)               |
| 다른 Context의 상태 변경(초대 활동 기록, 보상) | `DomainEventPublisherPort.publish(events)`를 UoW 안에서 호출 → 구독자별 pg-boss 작업(같은 트랜잭션) |
| 다른 Context의 캐시 무효화(insights 일간 완료) | 같은 publish의 `delivery: "after-commit"` 구독(`@nestjs/event-emitter`). 실패해도 TTL로 맞아진다    |

- `delivery: "after-commit"` 구독자가 상태를 쓰면 리뷰에서 막는다. 캐시 정리 전용이다.
- 이벤트 이름은 `<context>.<aggregate>.<과거형>`(`planning.todo.completed`)이다.

## 도메인 이벤트 fan-out

- 구독자 목록은 각 Context의 `*.event-handler.ts`가 `defineEventSubscription({ event, queue, handle })`으로 선언한 정적 코드 레지스트리다. 컴파일 시점에 정해져 타입 검사·테스트가 쉽다.
- publish는 구독자마다 그 큐에 `JobQueuePort.enqueue`를 같은 트랜잭션으로 넣는다. 구독자별 idempotency key는 `<eventId>:<subscription>`이고 재시도·DLQ가 구독자마다 붙는다. pg-boss 테이블이 곧 트랜잭셔널 아웃박스다.
- pg-boss 내장 `publish`/`subscribe`는 쓰지 않는다: 구독자 조회가 pg-boss 자체 풀(트랜잭션 밖)에서 돌고, 구독이 없으면 조용히 지나가고, 모든 구독 큐에 같은 job id가 가서 구독자별 결정적 id를 쓸 수 없다.
- payload는 이벤트의 Zod schema(발행 Context `*.public.ts`)로 구독자가 다시 `parse`한다. payload에 Temporal 객체를 넣지 않고 `toIsoString`으로 직렬화한다.
- 메시지 브로커가 필요해지면 어댑터만 `OutboxDomainEventPublisher`(같은 트랜잭션의 `DomainEventOutbox` 행 + 릴레이)로 바꾼다. Port·발행 코드·구독 계약은 그대로다.
- `PushDispatchOutbox`는 이벤트 아웃박스가 아니다. 기기별 발송·receipt를 추적하는 도메인 데이터라 그대로 둔다.

## 큐 정의

`defineQueue({ name, payloadSchema, policy, deadLetter, worker: { localConcurrency, batchSize, pollingIntervalSeconds }, schedule })`가 큐 하나의 정의다. producer·consumer·Health·스케줄이 같은 정의를 쓴다.

| 규칙         | 내용                                                                                                            |
| ------------ | --------------------------------------------------------------------------------------------------------------- |
| payload      | enqueue는 schema 타입으로 검사하고 소비 때 `parse`한다                                                          |
| 멱등         | at-least-once라 handler는 같은 payload 재실행에 멱등이다(`singletonKey`, 유니크 키, 상태 fence, `boolean` 전이) |
| 이름         | `teamSize` 대신 pg-boss 12 용어 `localConcurrency`                                                              |
| 묶음         | 발송량이 많은 큐는 `batchSize`. 묶음이 throw하면 전체가 재시도되므로 상태 fence로 멱등을 보장한다               |
| Health       | 등록된 큐 전부를 본다                                                                                           |
| 연결 예산    | 앱 풀 10 + pg-boss 3 = 13. 늘리지 않는다                                                                        |
| `startAfter` | Date·ISO 문자열을 넘긴다. Instant를 그대로 넘기지 않는다                                                        |
| 우선순위     | 거래성(리마인더·소셜) `priority: 10`, 마케팅 `0`. 거래성 worker는 `minPriority: 10`([알림](notifications.md))   |

**바꾸지 않는 운영 계약**

- 큐 이름 `*.v1`과 스케줄 key. 바꾸면 쌓인 작업과 스케줄을 잃는다.
- 결정적 job id의 key 문자열(`deterministicJobId(queue, key)`). 날짜가 들어간 key(`invite-qualify-reminder:${redemptionId}:${sendAt}`)도 Temporal 전환 뒤 바이트 단위로 같아야 `cancel()`이 지운다.
- 옛 payload schema(`LegacyAdminNotificationSchema`·`LegacySendDataSchema`, `ai-report-queue`의 locale 기본값). 배포 순간 쌓여 있는 작업을 위해 둔다.

## 크론 주기와 `missed` 정책

모든 스케줄은 `missed`를 명시한다(`defineQueue` schedule의 필수 필드). 기본값 `skip`은 배포로 내려간 사이의 실행을 버린다.

| 스케줄                                         | 주기                                 | `missed`·보완                         |
| ---------------------------------------------- | ------------------------------------ | ------------------------------------- |
| `tz-reminder-sweep`                            | 매분                                 | `once` + 워터마크 따라잡기(최대 15분) |
| `retention-stage-sweep`                        | 분 정밀도가 필요 없으면 5분          | 같은 워터마크                         |
| `push-receipts`                                | 5분, 15분 지난 ticket만              | `skip`(다음 실행이 남은 것을 처리)    |
| `push-delivery-outbox-relay`                   | 매분(복구용)                         | `skip`(스캔 기반)                     |
| `marketing-consent-reconfirm`                  | 매일 10:00 KST                       | `once`                                |
| `daily-suggestion`                             | 매시 정각에 "현지 07시대" 사용자     | `once`                                |
| 주간·월간 리포트                               | 매시 :05 UTC(사용자 현지 경계)       | `once`                                |
| `quota-abandoned-refund`·`premium-grant-sweep` | 10분                                 | `skip`                                |
| 03:00~03:30 KST 일간 정리, 04:30, 00:10        | 하루 1회, 10분 간격 분산(RDS 메모리) | `once`(멱등)                          |

**워터마크 따라잡기**: 마지막 성공 시각(`ScheduledSweepCursor` 행)부터 지금까지의 분(최대 15분)을 모두 처리한다. 중복은 기존 일간 dedup 유니크가 막는다. 15분 넘게 늦은 리마인더는 보내지 않고 사유를 남긴다.

## 배포 중 내구성

블루그린이 없어 `compose up` 동안 API와 worker가 잠깐 멈춘다.

| 대상                               | 보장                                                                                                           |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 할 일 리마인더(`todo-reminder.v1`) | 작업이 PostgreSQL에 남아 늦어질 뿐 유실 없음. 15분을 넘으면 사유와 함께 건너뜀                                 |
| 분 단위 sweep                      | 워터마크 따라잡기                                                                                              |
| 실행 중이던 작업                   | `stop_grace_period` 120초, graceful stop 90초, 넘으면 `expireInSeconds` 뒤 재시도. 상태 fence로 중복 발송 없음 |
| 푸시 발송                          | 커밋 뒤 즉시 발행이 실패하면 outbox 행을 매분 relay가 리스(15분) 뒤 다시 보낸다                                |
| 커밋 뒤 캐시 정리                  | best-effort. 중단되면 TTL까지 오래된 값(캐시만 허용)                                                           |

검증은 integration의 "worker 정지 → 시각 경과 → 재시작" 시나리오(FixedClock + 실제 pg-boss)다: 놓친 분의 리마인더가 한 번 발송되고, 15분 넘은 리마인더는 건너뛰고, 같은 작업이 두 번 처리돼도 푸시는 한 번이다. 배포 시각 runbook은 [배포](deployment.md#job과-종료)에 있다.

## 전환 중

아직 옮기지 않은 Context는 `JobRuntimePort`·`teamSize`, `*.job.ts`·`*-queue.constants.ts`로 흩어진 큐 정의, 커밋 뒤 `publishAll`과 `@OnEvent` 구독(리마인더 예약 5개·초대 활동 1개)을 쓴다. 새 publisher가 들어온 뒤에도 옛 `publishAll`·이벤트 이름 상수는 마지막 Context가 옮길 때까지 남는다. 구독을 옮기는 커밋은 같은 커밋에서 옛 `@OnEvent`를 지워 두 번 기록되지 않게 한다. 옮긴 Context는 `apps/api/architecture.ratchet.json`의 `migratedContexts`에 있다.
