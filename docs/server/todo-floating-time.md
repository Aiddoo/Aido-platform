# 할 일 떠 있는 시각

한국에서 만든 오전 10시는 미국에서도 오전 10시이고 알림도 현지 10시에 울린다. 값의 의미와 시간대 규칙은 [날짜·시간·언어 5절](../conventions/dates.md#5-떠-있는-시각)이 정본이고, 이 문서는 서버 구현과 운영을 적는다.

코드 정본은 `modules/planning/domain/value-objects/todos/todo-schedule.vo.ts`(`resolveScheduledInstant`), `application/services/todos/todo-timezone-resolver.service.ts`, `application/use-cases/todos/rebase-todo-timezone.use-case.ts`, `infrastructure/jobs/todos/`다.

## 쓰기

모든 쓰기 경로는 벽시계(`HH:mm`)를 받는다. 출시 앱을 포함해 순간을 보내는 경로는 없다.

| 경로                                                 | 시각을 정하는 곳                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------- |
| `POST /v1/todos`, 메모 변환, 계획 적용, AI 제안 수락 | `StagedTodoCreator.stage` → `TodoSchedule.create`                         |
| `POST /v1/todos/recurring`, 회차 채우기              | `TodoSeries`의 회차 초안                                                  |
| `PATCH /v1/todos/:id`(시간·날짜·완료 되돌리기)       | `Todo.updateDetails` → `TodoSchedule.patch`                               |
| `PATCH /v1/todos/:id/schedule`                       | `TodoSchedule.create`                                                     |
| `PATCH /v1/todos/:id/complete`(되돌리기)             | `Todo.toggleComplete` → `TodoSchedule.rederiveIn`                         |
| 이후 모두·규칙 변경·반복 전환                        | `UpdateFollowingTodos`, `StartSeriesFromTodo`의 `resolveScheduledInstant` |

날짜·시간을 건드리지 않는 수정(제목·공개·카테고리)은 순간을 바꾸지 않는다. 앞으로 할 일의 순간은 재계산이 맞춘다.

## 시간대 변경

```text
앱 요청 → 저장값 변경(자가 치유·토큰 등록·설정 변경) ─ 같은 트랜잭션 → todo-timezone-rebase.v1
                                                         60초 구간당 사용자당 하나, 구간이 끝난 뒤 시작
worker → 규칙 시간대 변경 → 500행씩: 잠금 → 최신 시간대 확인 → 행 잠금·읽기 → 순간 다시 계산 → 알림 재예약 → 커밋
```

- **이벤트가 아니라 같은 트랜잭션에서 넣는다.** 도메인 이벤트는 재시도가 없어 커밋 뒤 프로세스가 죽으면 변경을 영영 놓친다. 저장값이 바뀐 뒤에는 다음 요청도 "변경 없음"이라 복구할 기회가 없다. 작업 등록이 실패하면 시간대 변경도 되돌아가고 다음 요청이 다시 시도한다.
- **구간 작업**: 작업 key에 60초 구간을 넣고 구간이 끝난 뒤 시작한다. 그 구간의 어떤 변경도 작업 시작 전이므로 놓치지 않고, 실행 중에 온 변경은 다음 구간의 새 작업이 된다. 기기 두 대가 번갈아 요청해도 사용자당 1분에 한 번이다.
- **멱등**: 벽시계에서 계산하므로 몇 번을 돌아도 같다. 순간이 그대로면 쓰지 않아(서울 ↔ 도쿄) 재시도는 남은 행만 바꾼다.
- **동시성**: 잠금 순서는 `todoCategory → todoSortOrder → 규칙 행 → 할 일 행`이다(카테고리 삭제·회차 채우기·이후 모두와 같다). 할 일 행은 `FOR UPDATE`로 읽어 단건 수정과 겹쳐도 최신 벽시계로 계산한다. 시간대가 또 바뀌었으면 남은 묶음을 멈추고(`SUPERSEDED`) 다음 작업이 끝까지 계산한다.
- **재예약**: 행과 함께 커밋한다. 이미 지난 시각은 예약하지 않는다. 이미 울린 단계는 `Notification_todo_reminder_dedup` 유니크 인덱스(할 일 + 단계)로 다시 울리지 않는다. 서쪽으로 가서 시각이 다시 미래가 되어도 같다.
- **규모**: 규칙 30개 × 90일(2,700행, 예약 5,400개) 393ms·SQL 53문장·힙 +13MB, 옛 경로 상한 300개 × 90일(27,000행) 3.7초·442문장·힙 +86MB(로컬 Testcontainers, `test/performance/todo-timezone-rebase.performance-spec.ts`). 묶음당 8문장이고 행 수에 비례하지 않는다.

## 관측과 실패

- 완료 로그 `planning.todo.timezone-rebase.completed`: `outcome`(`COMPLETED`·`SUPERSEDED`·`NO_PREFERENCE`), `scannedCount`, `rebasedCount`, `skippedCount`, `seriesCount`, `timezone`, `durationMs`. 제목은 남기지 않는다.
- 시도별 실패 `planning.todo.timezone-rebase.failed`. pg-boss가 3번 다시 시도하고(30초, 백오프) 마지막 시도까지 실패하면 경보 `planning.todo-timezone-rebase-failed`가 오른다. 이때 그 사용자의 알림은 옛 시각이다. 표시는 벽시계라 맞다.
- `/health`의 job 상태에 `todo-timezone-rebase.v1` 대기·실행·실패 수가 보인다.
- 탈퇴·설정 없는 사용자는 `NO_PREFERENCE`로 조용히 끝난다. 정지·휴면 사용자도 그대로 계산하고 발송은 기존 리마인더 처리가 건너뛴다.

## 한계

- 서버는 앱 요청 전까지 시간대를 모른다. 앱을 열기 전 알림은 옛 시간대로 울린다. 푸시 수신만으로는 앱 코드가 돌지 않아 앞당길 수 없다.
- 완료·그제 이전 할 일의 `scheduledTime`은 만든 시간대의 순간 그대로다. 새 앱은 벽시계를 보여 주므로 어긋나지 않고, 출시 앱에서만 그 할 일의 시각이 달라 보일 수 있다.
- 날씨 푸시 문구는 순간을 알림 시간대로 적는다. 재계산 뒤에는 벽시계와 같다. 서머타임으로 없는 시각(뉴욕 02:30)만 전환 뒤 시각(03:30)으로 적힌다.
- 이미 울린 단계는 날짜를 옮겨도 다시 울리지 않는다. 시간대와 상관없는 기존 동작이다(유니크 인덱스).
