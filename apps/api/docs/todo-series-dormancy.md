# 반복 할 일 휴면·복귀

오래 앱을 열지 않은 사용자의 반복 규칙이 회차와 알림을 계속 만들지 않게 멈추고, 돌아오면 앱 변경 없이(구버전 포함) 첫 목록에 오늘 회차를 보여 주는 동작이다. HTTP 응답 모양과 기존 잡 payload는 바뀌지 않으며 이 동작을 위한 마이그레이션은 없다. 코드 정본은 `modules/planning/todo-series/domain/series-dormancy.domain-service.ts`, `todo-series/application/use-cases/{materialize-todo-series,catch-up-todo-series}.use-case.ts`, `TodoSeries.skipDormantGap`이다.

## 휴면

- 기준: `User.lastActiveAt`(없으면 가입일)의 날짜에서 사용자 시간대(`UserPreference.timezone`, 미상·UTC는 KST) 오늘까지 `TODO_SERIES_DORMANT_AFTER_DAYS`(60일)를 넘으면 휴면이다. 정확히 60일째는 아직 휴면이 아니다. 판단은 `isSeriesOwnerDormant` 하나다.
- 활동 기록은 `LastActiveInterceptor`의 기존 값을 그대로 쓴다. 인증된 모든 요청을 세지만 앱에는 사용자가 열지 않은 상태에서 나가는 요청이 없다(아래). 리텐션·윈백·성장 지표가 같은 값을 쓰므로 의미를 바꾸지 않는다.
- 유료(`PREMIUM`, 스토어 구독·보상 기간)와 `ADMIN` 등급은 휴면으로 보지 않는다(access의 `isExemptFromDormancy(tier)`, 소비자는 등급을 직접 비교하지 않는다). 매일 약 먹기처럼 알림만 받고 앱을 열지 않아도 끊기지 않는다. 구독이 끝나면 그때부터 무료 기준으로 잰다. `isPremium`의 의미는 그대로다.
- 회차 채우기: 무료 휴면 소유자의 규칙은 건너뛰고 커서를 그대로 둔다. 실행 결과 로그 `planning.todo-series.materialized`의 `dormantCount`로 센다.
- 알림: 이미 큐에 있는 `TODO_REMINDER`는 발송 시점에 확인한다. 반복 회차(`Todo.seriesId` 있음)이고 소유자가 무료 휴면이면 보내지 않고 `notification.todo-reminder.dormant-owner.skipped`(info, `todoId`·`userId`·`stage`)를 남긴다. 단일 할 일은 묻지도 않는다. 잡을 지우지 않고 기존 잡 payload도 그대로라 쌓여 있던 잡과 호환된다.
- 멈춤 안내: 처음 건너뛸 때 `send-series-paused-notice` 작업을 등록해 "반복 할 일 알림을 잠시 멈췄어요 / 앱을 열면 다시 시작돼요"(en "Repeating to-do reminders paused / Open the app to start them again")를 보낸다. 칸을 더하지 않고 key `series-paused_{userId}_{마지막 활동일}`로 휴면 기간당 한 번만 보낸다. 멈춘 리마인더가 커서가 앞서 있던 만큼(90일 남짓) 계속 돌아오므로 끝난 행을 120일 남긴다. 종류·목적이 리마인더와 같아(`TODO_REMINDER`·`SCHEDULED_SERVICE`) 기존 알림 동의를 따르고, 탭하면 그 회차로 간다. 앱이 열리면 인증된 첫 요청이 `lastActiveAt`을 갱신해 복귀가 시작된다. 알림 도착만으로는 세지 않는다.

### 백그라운드 요청이 활동으로 세이는가

세이지 않는다. 2026-11-05 코드와 저장소 이력 기준 근거:

- `expo-task-manager`·`expo-background-*`·`defineTask`·`registerTaskAsync`·iOS `UIBackgroundModes`·서버 `_contentAvailable` 모두 쓴 적이 없다. 알림이 와도 JS가 깨지 않는다.
- Android 위젯 태스크는 저장된 스냅샷을 그릴 뿐 API를 부르지 않고, 앱 화면 트리를 띄우지 않는다.
- 푸시 기기 보고(`usePushDeviceSync`)는 로그인 확인 직후·`AppState` active·토큰 변경·언어 변경 때만 보낸다. 토큰 변경 리스너만 포그라운드가 아닐 수 있지만 JS가 살아 있는 동안뿐이라 며칠 안에 앱을 연 사용자에게만 해당한다.
- TanStack Query `refetchInterval`은 `focusManager`(AppState) 기준으로 포그라운드에서만 돈다. `refetchIntervalInBackground`는 쓰지 않는다.
- 토큰 갱신은 다른 요청의 401에서만 일어난다.

구버전 앱은 포그라운드 여부를 헤더로 보내지 않아 요청만으로 구분할 수단도 없다. 그래서 인터셉터를 바꾸지 않았다. 나중에 백그라운드 작업을 도입하면 그 요청은 활동에서 제외해야 한다.

## 복귀

복귀 감지는 활동 기록이 아니라 **규칙 커서**로 한다. 인터셉터가 먼저(응답을 기다리지 않고) `lastActiveAt`을 갱신하므로 UseCase 시점에는 휴면이었는지 알 수 없다. 반면 커서는 평소 오늘보다 90일 앞서 있어서, 커서가 오늘을 넘지 못했다는 것 자체가 "오늘 회차가 없다"는 사실이다.

- 진입점: `GetTodos`·`GetTodoSummary` 시작에서 `TodoSeriesCatchUp.ensureCaughtUp(userId)`를 기다린다. 요약은 앱이 목록과 나란히 부르기 때문이다.
- 일반 요청 비용: 사용자·UTC 날짜마다 조회 1번(`findIdsBehind`, `(userId, nextOccurrenceDate)` 인덱스), 그 뒤 메모리만 본다(쿼리 0번). 조회 상한은 UTC 내일이라 어떤 시간대의 오늘도 포함한다. 메모리는 UTC 날짜가 바뀌면 비운다.
- 60~150일 사이에 돌아오면 커서가 아직 오늘보다 앞이다. 오늘 회차가 이미 있으므로 요청에서는 쓰지 않고, `lastActiveAt`이 갱신돼 다음 밤 작업이 이어서 채운다.
- 뒤처진 규칙은 규칙마다 트랜잭션: 잠금(`todoSortOrder`) → 규칙 행 → 커서를 오늘 이후 첫 회차로 옮김 → 90일 채움·알림 등록(같은 트랜잭션). 잠금 순서·저장은 밤 작업과 `TodoSeriesDueRun` 하나를 공유한다. 복귀는 다른 트랜잭션이 잡은 규칙을 기다리고(이 요청의 목록에 오늘 회차가 있어야 하므로), 밤 작업은 `SKIP LOCKED`로 건너뛴다.
- 지난 날은 만들지 않는다. 지난 시각의 알림도 `planReminderJobs`가 등록하지 않는다. `UNTIL`이 지났거나 `COUNT`의 날짜가 달력으로 다 지났으면 규칙이 끝나고(`nextOccurrenceDate = NULL`) 새 규칙을 만들지 않는다. `COUNT`는 지나간 날짜도 센다.
- 지난 날을 건너뛰는 조건은 "커서가 오늘보다 뒤"다(`skipDormantGap`). 규칙 행을 고쳤는지는 보지 않는다. 복귀 뒤 목록보다 먼저 범위 수정을 해도 건너뛴다. 채울 때마다 커서가 90일 앞서고 새 규칙의 지난 회차는 366개까지(`assertWithinPastLimit`)라 첫 실행(`MAX_OCCURRENCES_PER_RUN` 400)이 오늘을 넘기므로, 활동 중인 사용자의 커서가 뒤처지려면 밤 작업이 92일 이상 연속으로 멈춰야 한다. 그때도 지난 날은 건너뛴다.
- 동시성: 같은 프로세스의 같은 사용자 요청은 진행 중인 복귀 하나를 함께 기다린다. 프로세스가 달라도 잠금 + 커서 재확인 + `(seriesId, occurrenceDate)` 유니크로 중복이 없다.
- 실패: 어떤 실패도 요청으로 전파하지 않는다. `planning.todo-series.catch-up.failed`(warn, `userId`·`seriesId`·`errorType`)를 남기고 60초 뒤 다음 요청이 다시 시도한다. 5초(`DEADLINE_MS`, 앱 요청 제한 10초)를 넘기면 남은 규칙을 다음 요청에 맡긴다. 그 사이 사용자가 활동 중이므로 밤 작업도 같은 규칙으로 오늘부터 채운다. 완료는 `planning.todo-series.catch-up.completed`(`seriesCount`·`createdCount`·`failedCount`·`timedOut`·`durationMs`)다.
- 정지·탈퇴 대기 계정: `findDueBatch`·`findIdsBehind` 모두 제외한다. 세션 캐시(30초) 동안 토큰이 통과해도 회차를 만들지 않는다.
- 카테고리가 사라진 규칙: FK로 막혀 있지만 경합으로 생기면 그 규칙만 실패로 남고 나머지는 채운다.

측정(로컬 Docker PostgreSQL, 실제 pg-boss, 규칙마다 90일·체크리스트 10개·시간 있음): 1개 71ms, 5개 222ms, 30개 1.3~2.1초. 다음 날부터는 평소와 같다.

## 배포

이미 60일 넘은 사용자는 다음 작업부터 건너뛰고, 돌아오면 위 경로를 탄다. 별도 보정 작업과 마이그레이션은 없다.

## 전환 중

이 문서의 코드 이름·경로는 아직 옮기지 않은 옛 구조(`modules/<context>/<layer>/<slice>`) 기준이다. 해당 Context를 옮기면 경로만 [아키텍처](architecture.md)의 slice 구조로 바뀌고 규칙은 그대로다.
