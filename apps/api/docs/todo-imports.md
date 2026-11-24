# 캘린더 가져오기

기기 캘린더 일정을 할 일로 한 번 옮기는 흐름(`planning/todo-imports` slice)을 고치거나 새 출처를 더할 때 읽는다. 업무 용어와 상태 전이 표는 [planning 용어집](glossary/planning.md#todo-imports), 큐 일반 규칙은 [작업과 이벤트](jobs-and-events.md), 기간 권한은 [유료 기능과 권한](entitlements.md)이다.

## 흐름

```text
POST /v1/todo-imports            시작: 시간대를 한 번 정하고 기간·대상 카테고리를 확인해 UPLOADING으로 저장
POST /v1/todo-imports/:id/items  100개씩 올린다. 같은 sourceKey는 무시(ON CONFLICT)하고 3,000개를 넘으면 2309
POST /v1/todo-imports/:id/commit 시작 검사를 다시 하고 새 카테고리를 만든 뒤 QUEUED + round 0 작업(같은 트랜잭션)
planning.todo-import-materialization.v1  가까운 날짜부터 100개씩 할 일을 만들고 COMPLETED
POST /v1/todo-imports/:id/undo   끝난 뒤 7일 안이고 남은 할 일이 있으면 UNDOING + 되돌리기 작업 → UNDONE
```

- 앱은 읽고 보내기만 하고 무거운 생성은 서버 작업이 나눠 한다. 앱을 닫아도 작업은 이어진다.
- 남의 가져오기는 없는 것과 같이 404(2304)다. 모든 조회·변경은 `findByIdAndUserId`다.
- 같은 사용자의 진행 중 가져오기(UPLOADING·QUEUED·RUNNING·UNDOING)는 하나다. 부분 유니크 색인 `TodoImport_userId_active_key`가 막고 시작·되돌리기는 2301로 그 id를 알린다.
- 같은 `Idempotency-Key`의 시작은 본문 해시가 같으면 처음 가져오기를, 다르면 2307을 준다.
- 일정 제목은 할 일 제목으로만 쓰고 로그·경보에는 id·수만 남긴다.

## 시간대

가져오기 하나는 시간대 하나다. 규칙 원본은 [날짜](../../../docs/conventions/dates.md)다.

| 단계            | 시간대                                                                                                                                                                              |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 시작            | `@Timezone({ preserveIfMissing: true })` + `ResolveTodoTimezoneUseCase`(헤더 → 저장값 → 서울)로 한 번 정해 `TodoImport.timezone`에 저장하고 응답 `todoImport.timezone`으로 돌려준다 |
| 오늘·기간 검사  | `localDateIn(clock.now(), timezone)`. 일 수는 오늘을 포함해 센다(무료 30일이면 오늘 + 29일까지)                                                                                     |
| 확정            | 업로드가 자정을 넘겨도 막지 않고 요금제 일 수만 다시 본다(구독이 끝났으면 2302)                                                                                                     |
| 할 일 만들기    | `stageMany({ timezone: import.timezone })`. 벽시계(`startDate + localTime`)가 진실이고 순간은 같은 `TodoSchedule` 경로로 유도한다. 잡은 사용자의 지금 시간대를 다시 읽지 않는다     |
| 날짜만 가져오기 | `DATE_ONLY`면 시각을 버려 리마인더가 예약되지 않는다                                                                                                                                |
| 서머타임        | 가을 전환일에 두 번 오는 벽시계(LA 01:30)는 앞쪽 순간으로 본다. 할 일과 같은 [날짜 규칙](../../../docs/conventions/dates.md)이다                                                    |

기간 일 수와 2302의 `featureQuota`는 access가 정한다(`EntitlementReaderPort.getHorizonDaysInTransaction`·`getFeatureQuotaInTransaction(…, "CALENDAR_IMPORT", null)`). slice는 요금제 숫자를 읽지 않는다.

## 대상 카테고리

`AssertTodoImportTargetsUseCase`가 시작과 확정에서 같은 규칙으로 본다.

- 새 카테고리를 더하면 카테고리 수 한도를 넘으면 카테고리 만들기와 같은 `TODO_CATEGORY_0857`(`featureQuota`)이다.
- 새 카테고리 이름·색은 `TodoCategoryCreatorPort.assertDraftsValid`로 카테고리 만들기와 같은 규칙을 먼저 본다(`SYS_0002`).
- 이름 중복(`CATEGORY_NAME_TAKEN`)·없거나 남의 카테고리(`CATEGORY_NOT_FOUND`)를 대상마다 모아 2303 하나로 알린다.
- 카테고리 자리(300)는 시작·확정에서 막지 않는다. 기기가 센 수에는 중복으로 건너뛸 일정도 들어 있어서다. 할 일 만들기가 가까운 날짜부터 남는 만큼만 만들고 나머지는 `SKIPPED_CAPACITY`로 센다. `CAPACITY` 값은 계약에만 남는다.

## 할 일 만들기 작업

| 단계       | 내용                                                                                                                                                           |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 묶음       | 대기 항목 101개를 읽어 100개를 처리하고 남은 게 없으면 같은 트랜잭션에서 완료한다. 묶음 하나가 UoW 하나(`statementTimeoutMs` 20,000)다                         |
| 잠금       | `TodoImportLockKeys.userImports` → `TodoCategoryLockKeys.userCategories`·`TodoLockKeys.sortOrder`. 가져오기 잠금을 따로 먼저 잡아 할 일 쓰기와 엇갈리지 않는다 |
| 다시 읽기  | 묶음마다 가져오기를 다시 읽고 없거나(계정 삭제) 만드는 상태가 아니거나 round가 다르면 멈춘다                                                                   |
| 중복 제외  | `(userId, sourceKey)` 링크가 있으면 `SKIPPED_DUPLICATE`. 할 일을 지우면 링크도 FK로 지워져 다시 가져올 수 있다                                                 |
| 만들기     | `StagedTodoBatchCreatorPort.stageMany` 한 번(할 일 INSERT 한 문장, 리마인더 `enqueueMany` 한 번). 커밋 뒤 캐시 정리는 `afterCommitKey`로 한 번만 등록한다      |
| round 예산 | 60초 또는 1,000개를 쓰면 round를 올리고 다음 round 작업을 마지막 묶음과 같은 트랜잭션에 넣어 큐 뒤로 간다. 여러 사용자의 가져오기가 번갈아 돈다                |
| 실패       | `retryLimit` 3(backoff). 마지막 시도가 실패하면 FAILED(센 수 보존)와 경보 `planning.todo-import.failed`. 상태가 DB에 있어 dead letter 큐는 두지 않는다         |

로컬 E2E 측정(PostgreSQL 16, 메모리 큐): 할 일 100개 묶음 하나가 가져오기 읽기를 포함해 SQL 18문장이었다(begin·commit 포함). 운영은 같은 트랜잭션의 pg-boss insert(리마인더·이벤트)가 더해진다.

## 되돌리기 작업

- 받는 때: COMPLETED이거나, FAILED라도 만든 수 > 지운 수일 때 끝난 뒤 7일 안. 완료 시각이 있으면 그때부터, 없으면 실패한 때(`updatedAt`)부터 센다. 응답 `undoableUntil`은 이 판단(`judgeUndoWindow`)이 받을 때만 값이 있다.
- 링크된 할 일 id를 200개씩 오름차순으로 읽어 `RemoveTodosUseCase`로 지운다. 완료한 할 일은 남겨 연속 기록·성취를 지킨다.
- 지운 할 일의 링크는 FK로 사라지므로 다시 실행해도 지운 수를 두 번 세지 않는다. 끝에 남은 링크 수를 `keptCompleted`로 둔다.
- 되돌리기로 빈 새 카테고리는 지우지 않는다.

## 큐

| 큐                                        | 설정                                                                                               |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `planning.todo-import-materialization.v1` | `{ importId, round }`, job key `todo-import:{importId}:{round}`, INTERACTIVE, `localConcurrency` 1 |
| `planning.todo-import-undo.v1`            | `{ importId, round, afterTodoId }`, job key `todo-import-undo:{importId}:{round}`, 같은 설정       |
| `planning.todo-import-reconcile.v1`       | 10분마다(UTC), `missed: skip`, BACKGROUND, `expireInSeconds` 300                                   |
| `planning.todo-import-cleanup.v1`         | 매일 04:20 KST, `missed: skip`, BACKGROUND                                                         |

- 네 큐 모두 보관·삭제 1일이고 재조정 말고는 `expireInSeconds` 600이다. round 하나는 60초 예산이라 heartbeat가 필요 없다.
- 생성·되돌리기 큐는 `singleActivePerKey`(실행 key = 가져오기 id)라 배포 중 두 프로세스·재시도·다음 round가 겹쳐도 가져오기 하나에는 작업 하나만 돈다. 중복 등록은 round마다 정해진 job id가 막는다.
- 잡 하나가 가져오기 하나라 `pgboss.job` 행이 할 일 수만큼 늘지 않는다. 작업은 앱 풀 연결을 많아야 둘(생성 1 + 되돌리기 1) 쓴다.

| 상황                                  | 처리                                                                                                                                                 |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 확정 두 번·같은 round 두 번           | 확정은 상태로 멱등, 같은 job id는 무시된다                                                                                                           |
| 묶음 커밋 뒤 작업 완료 표시 전에 죽음 | 재시도가 남은 PENDING부터 이어 간다. 만든 할 일·항목 표시·링크가 같은 트랜잭션이다                                                                   |
| 일정 하나가 잘못됨                    | 그 항목만 `SKIPPED_INVALID`로 두고 계속한다                                                                                                          |
| 작업을 잃음                           | 10분 주기 재조정이 진행 없이 10분 지난 QUEUED·RUNNING·UNDOING을 round를 올려 다시 넣고(최대 3번), 그 뒤 FAILED와 경보 `planning.todo-import.stalled` |
| 업로드가 멈춤                         | 24시간 넘게 그대로인 UPLOADING은 ABANDONED로 닫고 받아 둔 일정을 지운다                                                                              |
| 처리 중 계정 삭제                     | FK cascade로 가져오기가 사라지면 작업은 할 일 없이 끝난다                                                                                            |

매일 정리는 끝난 가져오기의 임시 일정을 7일, 기록을 30일 뒤 500개씩 지운다(`(status, updatedAt)` 색인).

## 큐를 바꿀 때

작업은 신호일 뿐이고 상태는 PostgreSQL(`TodoImport`·`TodoImportItem`)에 있다. at-least-once 큐면 어디서든 결과가 같다.

- UseCase는 `TodoImportMaterializationQueuePort`·`TodoImportUndoQueuePort`만 알고 어댑터가 공용 `JobQueuePort`를 부른다. 큐를 바꾸면 `JobQueuePort` 어댑터만 새로 쓴다.
- pg-boss의 "같은 DB 트랜잭션 안 enqueue"를 Redis·BullMQ·SQS는 못 한다. 그때는 커밋 때 outbox 행을 쓰고 릴레이가 보내는 방식(`PushDispatchOutbox`처럼)이나 커밋 뒤 enqueue를 쓰고, 유실은 위 재조정자가 덮는다.
- `singleActivePerKey`는 BullMQ group 동시성·SQS FIFO 메시지 그룹으로 옮긴다.

## 출처 더하기

서버가 가져오는 출처(Google Calendar API, Microsoft To Do, .ics)는 연결·토큰 slice, `TodoImportSourcePort` + `<Vendor>TodoImportSourceAdapter`·`*.wire.ts`·outbound policy, 같은 `TodoImportItem`을 채우고 확정으로 잇는 `planning.todo-import-fetch.v1` 작업만 더한다. HTTP·생성·링크·되돌리기는 그대로이고 `TODO_IMPORT_SOURCES`에 값만 추가한다.

## 테스트

| 층   | 파일                                                                                                                                                           |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 단위 | `domain/*.spec.ts`(전이·기간·되돌리기 창), `application/use-cases/*.spec.ts`(InMemory + `FixedClock`)                                                          |
| 계약 | `test/contracts/planning/todo-import*-repository.contract.ts`(InMemory·Drizzle)                                                                                |
| 통합 | `test/integration/planning/todo-imports/`(저장소, 핫 쿼리 EXPLAIN), `test/integration/platform/jobs/job-queue-postgres.integration-spec.ts`(key당 하나만 실행) |
| E2E  | `test/e2e/planning/todo-imports.e2e-spec.ts`(흐름·오류·되돌리기·문장 수), `todo-imports-worker.e2e-spec.ts`(실제 pg-boss round·재전달·리마인더)                |
