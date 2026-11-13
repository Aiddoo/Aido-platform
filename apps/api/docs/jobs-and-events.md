# 작업과 이벤트 (pg-boss·도메인 이벤트·크론)

큐·스케줄·도메인 이벤트 구독을 만들거나 바꿀 때, 배포 중 작업 유실을 판단할 때 읽는다. 푸시 큐와 작업 key는 [푸시 발송](push-delivery.md#큐와-작업-key)에 있다.

## 판단: 어떤 방식으로 보내는가

문제는 EventEmitter가 아니라 내구성 없는 전달로 업무 상태를 바꾸는 것이다.

| 반응                                          | 방식                                                                                                             |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 같은 Context 반응(할 일 변경 → 리마인더 예약) | 이벤트 없이 UseCase가 같은 트랜잭션에서 포트를 직접 호출(`ApplyTodoEventsUseCase` → `TodoReminderSchedulerPort`) |
| 다른 Context의 상태 변경(초대 활동 기록)      | UoW 안 `DomainEventPublisherPort.publish(events)` → `delivery: "durable"` 구독의 pg-boss 작업(같은 트랜잭션)     |
| 다른 Context의 캐시 정리                      | 같은 `publish`의 `delivery: "after-commit"` 구독. 실패해도 TTL로 맞아진다                                        |

- `delivery: "after-commit"` 구독자가 상태를 쓰면 리뷰에서 막는다. 캐시 정리 전용이다.
- 이벤트 이름은 `<context>.<aggregate>.<과거형>`(`planning.todo.completed`)이다.

## 도메인 이벤트 fan-out

- 구독은 `*.event-handler.ts`가 `defineEventSubscription({ name, eventName, delivery, payloadSchema, queue })`로 선언하고(`shared/application/ports/domain-event-publisher.port.ts`), slice module `providers`에 `provideEventSubscriptions(...)`로 넣는다. `EventSubscriptionCatalog`가 조립 때 모은다(이름이 겹치면 부팅 실패). 사례: [InviteeActivityEventHandler](../src/modules/social/invites/infrastructure/event-handlers/invitee-activity.event-handler.ts)(`social.invitee-activity` ← `planning.todo.completed`).
- 이벤트는 `PublishedDomainEvent`(`eventName`·`eventId`·`occurredAt`·`toPayload()`)다. [FanOutDomainEventPublisher](../src/platform/events/fan-out-domain-event.publisher.ts)가 구독 schema로 먼저 `parse`해 계약이 어긋나면 트랜잭션째 실패한다.
- `durable`은 구독마다 그 큐에 `JobQueuePort.enqueue`를 같은 트랜잭션으로 넣는다. idempotency key는 `<eventId>:<subscription name>`이라 구독 이름을 바꾸면 같은 이벤트가 다시 전달된다. worker는 구독 Context가 `JobQueuePort.work(queue, …)`로 등록한다. pg-boss 테이블이 곧 트랜잭셔널 아웃박스다.
- `after-commit`은 커밋 뒤 `EventEmitter2.emitAsync(subscription.name, payload)`로 보낸다. 받는 쪽은 그 구독 이름 채널을 `EventEmitter2`로 듣고, 실패는 구독 단위로 로그(`PlatformLogEvent.DOMAIN_EVENT_PUBLISH_FAILED`)만 남긴다.
- payload는 발행 Context `*.public.ts`의 Zod schema(`todoChangedPayloadSchema`)로 구독자가 다시 `parse`한다. payload에 Temporal 객체를 넣지 않고 `toIsoString`으로 직렬화한다.
- pg-boss 내장 `publish`/`subscribe`는 쓰지 않는다: 구독자 조회가 pg-boss 자체 풀(트랜잭션 밖)에서 돌고, 구독이 없으면 조용히 지나가고, 구독자별 결정적 id를 쓸 수 없다.
- 메시지 브로커가 필요해지면 어댑터만 아웃박스 행 + 릴레이로 바꾼다. Port·발행 코드·구독 계약은 그대로다. `PushDispatchOutbox`는 이벤트 아웃박스가 아니라 기기별 발송을 추적하는 도메인 데이터다.

**after-commit 사례**: insights `DailyCompletionCacheEventHandler`가 planning이 내는 할 일·회차·카테고리 이벤트 이름마다 `delivery: "after-commit"` 구독을 선언하고 그 사용자의 일간 완료 캐시만 버린다. 구독을 새로 옮기거나 바꾸는 커밋은 같은 커밋에서 옛 전달 경로를 지워 두 번 처리되지 않게 하고 "한 번만" integration으로 확인한다.

## 큐 정의

[defineQueue](../src/shared/application/ports/job-queue.port.ts)`({ name, payloadSchema, retry, deadLetter, worker, schedules })`가 큐 하나의 정의다. producer·consumer·Health·스케줄이 같은 정의를 `JobQueuePort`에 넘긴다.

```ts
export const DOCUMENT_QUEUE = defineQueue({
  name: "document.v1",
  payloadSchema: documentPayloadSchema,
  retry: DOCUMENT_RETRY,
  worker: { localConcurrency: 1, pollingIntervalSeconds: JOB_POLLING_SECONDS.BACKGROUND },
  schedules: [
    {
      key: "daily-document",
      cron: "0 3 * * *",
      timezone: "Asia/Seoul",
      missed: "once",
      payload: {},
    },
  ],
});

await jobQueue.enqueue(DOCUMENT_QUEUE, payload, { idempotencyKey, startAfter, priority }); // 활성 UoW 트랜잭션에 쓴다
await jobQueue.work(DOCUMENT_QUEUE, async (jobs) => {
  /* jobs[].data는 schema로 parse된 값 */
});
await jobQueue.registerSchedules(DOCUMENT_QUEUE); // schedules를 key별로 upsert
```

| 규칙         | 내용                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| payload      | enqueue는 schema 타입으로 검사하고 소비 때 `parse`한다. 맞지 않는 작업은 handler에 오지 않고 그 작업만 실패한다                                                                                                                                                                                                                                                                                          |
| 멱등         | at-least-once라 handler는 같은 payload 재실행에 멱등이다(idempotency key, 유니크 키, 상태 fence, `boolean` 전이)                                                                                                                                                                                                                                                                                         |
| 이름         | 새 큐는 `<context>.<purpose>.v1`. worker 동시성은 pg-boss 12 용어 `localConcurrency`                                                                                                                                                                                                                                                                                                                     |
| 묶음         | 발송량이 많거나 같은 시각에 몰리는 큐는 `batchSize`(+`burstWhenBatchFull`). handler가 throw하면 묶음 전체가 재시도되므로 상태 fence로 멱등을 보장한다. 다시 실행하면 한 번 더 보내는 작업이 섞인 큐는 `isolateJobFailures`로 작업마다 끝낸다(`notification.v1`·`push-delivery.v1`). 작업마다 끝내면서 조회·발행을 묶을 큐는 `workBatch`로 묶음을 한 번에 받고 실패한 작업만 돌려준다(`todo-reminder.v1`) |
| Health       | `JobQueuePort.health()`는 이 프로세스가 정의로 쓴 큐와 그 DLQ(`JobQueueRegistry`)를 본다. 큐를 따로 목록에 적지 않는다                                                                                                                                                                                                                                                                                   |
| 연결 예산    | 앱 풀 10 + pg-boss 3 = 13. 늘리지 않는다                                                                                                                                                                                                                                                                                                                                                                 |
| `startAfter` | 포트는 `Temporal.Instant`를 받고 어댑터가 Date로 바꿔 pg-boss에 넘긴다                                                                                                                                                                                                                                                                                                                                   |
| 우선순위     | 거래성(리마인더·소셜) `priority: 10`, 마케팅 `0`. 거래성 worker는 `minPriority: 10`([알림 발송 설계](notifications.md#발송-우선순위)). 같은 큐의 두 번째 worker는 `{ ...QUEUE, worker }`로 정의를 하나 더 둔다                                                                                                                                                                                           |

**연결 예산(알려진 한계)**: 운영 RDS `max_connections`는 79이고 API 프로세스 하나가 앱 풀 최대 10 + pg-boss 풀 최대 3 = 13개를 쓴다. 선언된 worker `localConcurrency` 합은 약 47인데 handler의 DB 작업은 모두 HTTP 요청과 같은 앱 풀 10개를 나눠 쓴다. 한꺼번에 몰리면 handler가 연결을 기다리다 `DATABASE_POOL_CONNECTION_TIMEOUT_MS`(5초)에 실패해 재시도되고 HTTP는 503이 된다. 지금은 이 한계를 알고 둔다. worker 동시성이나 프로세스 수를 바꿀 때는 (프로세스 수 × 13)이 79 안에 드는지와 앱 풀 대기를 함께 본다.

- 큐·스케줄은 모두 `defineQueue` + `JobQueuePort` 하나로 만든다. `PgBossJobQueueAdapter`가 등록·소비·스케줄·Health와 시작·종료(`JobQueueLifecycle`)를 맡고, pg-boss를 직접 부르거나 큐 이름 문자열을 따로 적지 않는다.
- E2E 앱은 `JobQueuePort`를 [InMemoryJobQueue](../test/doubles/platform/in-memory-job-queue.ts)로 바꾼다.

**바꾸지 않는 운영 계약**

- 큐 이름 `*.v1`과 스케줄 key. 바꾸면 쌓인 작업과 스케줄을 잃는다.
- 결정적 job id의 key 문자열(`deterministicJobId(queue, key)`). 날짜가 들어간 key(`invite-qualify-reminder:<수락>:<발송 시각>`)도 바이트 단위로 같아야 `cancel()`이 지운다.
- 옛 payload schema(`admin-notification.queue.ts`의 `LegacyAdminNotificationSchema`·`LegacySendDataSchema`, `ai-report.queue.ts`의 선택 `locale`). 배포 순간 쌓여 있는 작업을 위해 둔다. 지울 시점은 [호환](../../../docs/conventions/compatibility.md)에 적는다.

## 크론 주기와 `missed` 정책

`defineQueue` 스케줄은 `missed`가 필수다. `skip`은 배포로 내려간 사이의 실행을 버리고, `once`는 놓친 실행 중 마지막 하나를 보낸다. 재시도를 다 쓴 실패·늦거나 계속 실패하는 스케줄·DLQ 유입·worker 정지는 [작업 실패 경보](observability.md#작업-실패-경보)가 알린다.

| 스케줄 key                                     | 큐                                            | 주기                              | `missed`·보완                         |
| ---------------------------------------------- | --------------------------------------------- | --------------------------------- | ------------------------------------- |
| `tz-reminder-sweep-scheduler`                  | `timezone-reminder.v1`                        | 매분                              | `once` + 워터마크 따라잡기(최대 15분) |
| `retention-stage-sweep-scheduler`              | `retention.v1`                                | 매분                              | `once` + 상태 기준 조회(아래)         |
| `push-receipts-scheduler`                      | `notification.v1`                             | 5분, 15분 지난 ticket만           | `skip`(다음 실행이 남은 것을 처리)    |
| `push-delivery-outbox-relay-scheduler`         | `push-delivery.v1`                            | 매분(복구용)                      | `skip`(스캔 기반)                     |
| `schedule-watchdog-scheduler`                  | `schedule-watchdog.v1`                        | 15분                              | `skip`                                |
| `hourly-marketing-consent-reconfirm-scheduler` | `notification.marketing-consent-reconfirm.v1` | 매시 정각(현지 야간은 미룸)       | `skip`(다음 실행이 같은 조건)         |
| `daily-suggestion-scheduler`                   | `ai-suggestion-analysis.v1`                   | 매시 정각, 현지 07시대인 사용자만 | `once`                                |
| `weekly-report-scheduler`                      | `ai-report-generation.v1`                     | 매시 5분, 현지 새 주가 된 사용자  | `once`                                |
| `monthly-report-scheduler`                     | `ai-report-generation.v1`                     | 매시 5분, 현지 새 달이 된 사용자  | `once`                                |
| `premium-grant-sweep-scheduler`                | `premium-grant-sweep.v1`                      | 10분                              | `skip`                                |
| `quota-abandoned-refund-scheduler`             | `quota-abandoned-refund.v1`                   | 10분                              | `skip`                                |
| `daily-signup-summary-scheduler`               | `admin-notification.v1`                       | 00:10 KST                         | `once`                                |
| `daily-account-purge-scheduler`                | `account-purge.v1`                            | 03:00 KST                         | `skip`                                |
| `daily-todo-series-materialization-scheduler`  | `todo-series-materialization.v1`              | 03:10 KST                         | `once` + 실행일 키                    |
| `daily-plan-application-cleanup-scheduler`     | `voice-plan-application-cleanup.v1`           | 03:20 KST                         | `once`                                |
| `daily-invite-maintenance-scheduler`           | `invite-maintenance.v1`                       | 03:30 KST                         | `skip`                                |
| `daily-outbound-usage-retention`               | `outbound-usage-retention.v1`                 | 04:30 KST                         | `skip`                                |

- 사용자 현지 시각에 맞춰야 하는 작업(제안·리포트)은 고정 KST가 아니라 매시 실행에서 "지금 현지 경계에 있는 사용자"를 고른다.
- 하루 한 번인 정리 작업은 03:00~04:30 KST에 10분 이상 간격으로 흩어 RDS 메모리 압박을 피한다. 모두 멱등이고, 놓친 하루를 다음 실행이 같이 처리하는 작업은 `skip`, 그날 실행이 꼭 필요한 작업은 `once`다.
- 스케줄을 더하거나 옮기면 이 표에 한 줄을 더한다.

**광고성 동의 재확인을 하루 한 번으로 줄이지 않는 이유**: 현지 야간(21:00~08:00) 사용자는 표시하지 않고 다음 실행에 남기는데, 하루 한 번 고정 시각은 어떤 시간대에서는 늘 야간이라 그 사용자들이 영영 알림을 받지 못한다. 대상이 없으면 인덱스 조회 한 번이라 매시 실행이 싸다.

**워터마크 따라잡기**: 마지막 성공 시각(`ScheduledSweepCursor` 행)부터 지금까지의 분(최대 15분)을 모두 처리한다. 중복은 기존 일간 dedup 유니크가 막는다. 15분 넘게 늦은 리마인더는 보내지 않고 사유를 남긴다.

```ts
const lastCompletedAt = await sweepCursor.findLastCompletedAt("tz-reminder-sweep");
for (const minute of minutesToSweep({ lastCompletedAt, now: clock.now(), maxCatchUpMinutes: 15 })) {
  await sweepMinute(minute);
  await sweepCursor.markCompleted("tz-reminder-sweep", minute); // 더 이른 시각으로는 되돌리지 않는다
}
```

- `SweepCursorPort`(`shared/application/ports`)는 활성 UoW 트랜잭션에 쓰므로 분 처리와 커서 갱신을 같은 UoW에 넣으면 함께 커밋된다.
- `minutesToSweep`(`shared/application/minutes-to-sweep.ts`)은 처음이면 지금 분만, 시계가 거꾸로 가면 지금 분만, 이미 지금 분을 끝냈으면 빈 목록을 준다.
- `SweepTimezoneRemindersUseCase`가 분마다 처리 뒤 커서를 옮기고, 15분을 넘은 분은 `late-over-15m` 사유와 건너뛴 분 수를 남긴다. `todo-reminder.v1` 작업도 의도한 발송 시각(할 일 시각 - 단계 리드)보다 15분 넘게 늦으면 같은 사유로, 할 일 시각이 됐으면 `todo-started`로 건너뛴다. 마지막 발송 시각은 min(발송 시각 + 15분, 할 일 시각)이라 10분 단계는 10분까지만 늦을 수 있다(`reminderLateSkipReason`).

**같은 분에 몰리는 리마인더**: `batchSize` 없이 15초 폴링이면 프로세스 전체가 분당 4건만 꺼내 같은 분의 60번째쯤부터 늦음 한도에 걸린다. `todo-reminder.v1`은 worker 하나(`localConcurrency: 1`, 앱 풀 연결 하나)가 20건씩 꺼내고 묶음이 차면 쉬지 않고 다음을 꺼낸다. 묶음마다 할 일·언어를 한 번씩 읽고 리마인더를 `publishBatch` 한 번(한 트랜잭션, 유니크 인덱스 + `onConflictDoNothing`)으로 넣는다. 발송은 `deliveryMode: "SINGLE"`로 단건 경로를 그대로 타 설정 행이 없는 사용자도 단건 publish처럼 기본 설정으로 받는다. 늦음·휴면 판단은 작업마다 하고, 묶음 발행이 실패하면 한 건씩 다시 보내 막은 작업만 실패로 돌려준다. 로컬 PG에서 작업마다 읽고 발행하던 때 200건 1.7초·2,000건 9.9~19.3초가 묶은 뒤 200건 0.2초·2,000건 1.3~1.7초였다(호스트 부하에 따라). 운영 시간은 재지 않았다.

**상태 기준 조회**(`retention-stage-sweep`): 단계 후보를 시각 구간이 아니라 `SCHEDULED` 상태와 "결정할 때가 됐는가"(`isRetentionStageDue`와 같은 SQL)로 고르므로 워터마크 커서가 필요 없다. 한 실행은 생성 순서 위치로 이어 읽어(200건씩 최대 10묶음) 실패한 단계에 막히지 않는다. 중복은 `SCHEDULED → OUTBOXED`·`SKIPPED` 조건부 전이가 막는다.

## 작업 실패 경보와 스케줄 감시

작업이 조용히 멈추는 것을 사람이 알 수 있어야 한다. 신호·판정·중복 제거의 상세는 [관측](observability.md#작업-실패-경보)에 있다.

- 재시도를 다 쓴 마지막 실패(DLQ로 가는 실패)만 경보를 올린다. 중간 재시도 실패는 `jobs.attempt.failed` 로그로만 남긴다. 같은 경보 key는 dedup으로 묶여 장애 하나가 경보 폭주가 되지 않는다.
- 스케줄 감시 작업(`schedule-watchdog.v1`, 15분)이 pg-boss에 등록된 스케줄을 보고 예정 시각이 지났는데 실행되지 않음, 실패만 있음, DLQ 유입을 경보로 올린다. 새 스케줄은 `defineQueue`에 넣으면 감시 대상이 된다.
- worker 전체가 살아 있는지는 Sentry Cron 모니터 하나(`aido-job-worker`)로 본다. 큐마다 monitor를 만들지 않는다.

## 배포 중 내구성

블루그린이 없어 `compose up` 동안 API와 worker가 잠깐 멈춘다.

| 대상                               | 보장                                                                                                                         |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 할 일 리마인더(`todo-reminder.v1`) | 작업이 PostgreSQL에 남아 늦어질 뿐 유실 없음. 15분을 넘거나 할 일 시각이 지나면 사유와 함께 건너뜀                           |
| 분 단위 sweep                      | 워터마크 따라잡기                                                                                                            |
| 실행 중이던 작업                   | `stop_grace_period` 120초, graceful stop 90초(`JOB_SHUTDOWN_TIMEOUT_MS`), 넘으면 만료 뒤 재시도. 상태 fence로 중복 발송 없음 |
| 푸시 발송                          | 커밋 뒤 즉시 발행이 실패하면 outbox 행을 매분 relay가 리스(작업 만료 5분 + 공급자 전송 여유 10분) 뒤 다시 보낸다             |
| 커밋 뒤 캐시 정리                  | best-effort. 중단되면 TTL까지 오래된 값(캐시만 허용)                                                                         |

검증은 [reminder-sweep-catch-up](../test/integration/notification/reminders/reminder-sweep-catch-up.integration-spec.ts)의 "worker 정지 → 시각 경과 → 재시작" 시나리오(FixedClock + 실제 pg-boss)다. 배포 시각은 [배포](deployment.md#job과-종료)에 있다.

## 전환 중

초대 활동 기록은 `social.invitee-activity` 내구성 구독(`social.invitee-activity.v1`), insights 일간 완료 캐시 정리는 planning 이벤트의 `after-commit` 구독이다. 옛 `publishAll`·이벤트 이름 상수·`@OnEvent` 구독은 없다. planning 완료 효과(스트릭·친구 완료 알림·마일스톤)는 `ApplyTodoCompletionEffectsUseCase`가 토글과 같은 트랜잭션에서 한다. 스트릭은 응답 직후 위젯·요약에 보여야 해서 큐로 미루지 않고, 알림은 작업 행이 함께 커밋된다.
