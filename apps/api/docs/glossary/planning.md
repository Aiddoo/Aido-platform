# planning 용어집

할 일·카테고리·반복 할 일 기능을 설계·리뷰할 때 읽는다. 쓰는 법은 [용어집](../glossary.md)이다.

사용자가 날짜마다 할 일과 그 묶음·반복을 소유한다. slice마다 Aggregate가 하나다: `todos`(`Todo`), `todo-categories`(`TodoCategory`), `todo-series`(`TodoSeries`). `planning/shared/domain`에는 두 slice 이상이 쓰는 VO·도메인 서비스(제목·달력·정렬 간격)만 둔다. `todo-series`는 회차 행을 `todos`의 `TodoOccurrenceWriterPort`로만 쓰고, 두 slice가 함께 쓰는 할 일 포트 바인딩은 `PlanningTodoPortsModule`이다. todos는 반복을 `planning-todo-series.public.ts`로 쓰고 todo-series는 할 일 포트 파일을 바로 import한다(할 일 public은 반복 Module을 import하는 기능 Module을 열어 되돌아 쓰면 파일 순환이 된다). 다른 Context는 `planning-todos-queries.public.ts`(import 없는 조회 Module)와 `planning-todos.public.ts`(기능 Module)를 쓴다. 규칙 상세는 [카테고리 삭제](../todo-categories.md)·[반복](../todo-series.md)·[휴면·복귀](../todo-series-dormancy.md)·[떠 있는 시각](../todo-floating-time.md)이다.

| 용어      | 코드                                                                   | 뜻                                                                                                                        |
| --------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 제목      | `TodoTitle`(VO)                                                        | 1자 이상 `TODO_LIMITS.TITLE_MAX_LENGTH`자 이하. 할 일·하위 항목·반복의 제목이 모두 이 VO를 거치고, 틀리면 `SYS_0002`      |
| 시각      | `scheduledLocalTime`, `resolveScheduledInstant`                        | 사용자가 고른 벽시계(HH:mm)가 진실이다. 알림 순간 `scheduledTime`은 날짜 + 벽시계 + 사용자 시간대로 만든 파생값이다       |
| 종일      | `isAllDay`                                                             | 시각이 없는 할 일. 시각이 있으면 종일이 아니다                                                                            |
| 시간대    | `ResolveTodoTimezoneUseCase`, `localDateAt`                            | 쓰기는 요청 헤더 → 저장값 → 기본값 순으로 정한다. 스트릭·요약·회차의 "오늘"은 이 시간대의 날짜다                          |
| 공개 범위 | `TodoVisibility`(`TODO_VISIBILITIES`)                                  | PUBLIC·PRIVATE. 친구 할 일·친구 일일 완료·콕 찌르기는 PUBLIC만 본다                                                       |
| 잠금      | `TodoCategoryLockKeys.userCategories`, `TodoLockKeys.sortOrder`·`todo` | 카테고리 → 정렬 → 규칙 행 → 할 일 행 순서로 잡는다. notes·voice·ai-assistance도 같은 키를 잡으므로 문자열을 바꾸지 않는다 |

## todos

| 용어              | 코드                                                                                                                                       | 뜻                                                                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 할 일             | `Todo`(Aggregate, slice `todos`), `TodoId`                                                                                                 | 사용자가 정한 날에 할 일 하나. 단일 할 일이거나 반복의 회차다                                                                                                                         |
| 일정              | `TodoSchedule`(VO)                                                                                                                         | 시작일·종료일·벽시계·순간·종일. 종료일이 시작일보다 빠르면 `SYS_0002`이고, 종료일이 있으면 그 사이 모든 날에 보인다                                                                   |
| 하위 항목         | `TodoItem`(Entity), `TodoItemId`                                                                                                           | 할 일 안의 체크 한 줄(API `items`). Root를 거쳐서만 바뀐다. `TODO_ITEM_LIMITS.MAX_PER_TODO`개를 넘으면 `TODO_0821`, 없는 항목은 `TODO_0822`                                           |
| 완료              | `completed`·`completedAt`, `complete`·`reopen`, `SetTodoCompletedUseCase`                                                                  | 할 일 하나를 끝낸 상태와 그 시각. `PATCH /v1/todos/:id/complete`와 `PATCH /v1/todos/:id`의 `completed`가 같은 행동을 탄다. insights의 "완료한 날"(그날 할 일을 모두 끝낸 날)과 다르다 |
| 완료 효과         | `ApplyTodoCompletionEffectsUseCase`                                                                                                        | `todo.toggled`가 나온 같은 트랜잭션에서 스트릭을 고치고, 완료면 마일스톤·친구 완료 알림 작업을 넣는다. 전용 완료·일반 PATCH·하위 항목 더하기가 모두 부른다                            |
| 마일스톤          | `milestoneForCount`, `TodoCompletionMilestone`                                                                                             | 누적 완료 수가 정확히 1·10·50·100이 된 알림. 지나친 수로는 다시 보내지 않는다                                                                                                         |
| 오늘 다 함        | `isAllCompletedToday`                                                                                                                      | 오늘 할 일이 하나 이상이고 모두 끝냈다. 맞팔 친구에게 친구 완료 알림을 보낸다                                                                                                         |
| 순서              | `sortOrder`, `sortOrderBetween`, `ReorderTodoUseCase`                                                                                      | 사이를 띄운 정수(`TODO_SORT_ORDER_GAP`). 이웃 사이 값 한 행만 쓰고 자리가 없을 때만 그 사용자 할 일을 다시 매긴다. 기준 할 일이 없으면 `TODO_0810`                                    |
| 카테고리 한도     | `countCategoryUsage`, `TODO_LIMITS.MAX_PER_CATEGORY`                                                                                       | 반복 아닌 미완료 할 일 + 진행 중 반복 1개당 1을 센다. 넘으면 `TODO_0811`(옛 반복 경로는 `TODO_0813`)                                                                                  |
| 만들기            | `StagedTodoCreatorPort.stage`, `StageTodoCreationUseCase`, `CreateTodoUseCase`                                                             | 손으로·메모 변환·음성 계획·AI 제안 수락이 모두 타는 생성 경로 하나. 반복을 함께 보내면 규칙과 첫 회차들을 만든다                                                                      |
| 수정              | `EditTodoUseCase`, `UpdateTodoUseCase`                                                                                                     | `PATCH /v1/todos/:id` 하나. 요청 모양으로 단건 수정·이후 모두 고치기·반복 시작·반복 끝내기를 고르고 한 트랜잭션에 저장한다                                                            |
| 수정 범위         | `TodoEditScope`(`TODO_EDIT_SCOPES`)                                                                                                        | 회차를 고치거나 지울 범위 THIS_ONLY·THIS_AND_FOLLOWING·ALL. 수정에는 ALL이 없다(`TODO_UPDATE_SCOPES`). 반복이 아닌데 고르면 `TODO_0844`                                               |
| 친구 할 일        | `ListFriendTodosUseCase`                                                                                                                   | 맞팔 친구의 PUBLIC 할 일. 맞팔이 아니면 `FOLLOW_0906`                                                                                                                                 |
| 요약              | `GetTodoSummaryUseCase`, `resolveTodoSummaryDate`                                                                                          | 홈 위젯의 오늘·내일 요약. 다른 날은 `SYS_0002`                                                                                                                                        |
| 개요              | `GetTodoOverviewUseCase`                                                                                                                   | 할 일·완료한 할 일·진행 중 반복(`hasActiveRepeat`)이 있는지                                                                                                                           |
| 시간대 재계산     | `RebaseTodoTimezoneUseCase`                                                                                                                | 사용자 시간대가 바뀌면 시각 있는 모든 할 일의 순간을 벽시계에서 다시 만든다. 알림은 앞으로 울릴 미완료만 다시 잡는다                                                                  |
| 회차 쓰기         | `TodoOccurrenceWriterPort`                                                                                                                 | `todo-series`가 회차 행을 만들고 고치고 지우는 유일한 문                                                                                                                              |
| 카테고리째 지우기 | `RemoveCategoryTodosUseCase`                                                                                                               | 카테고리 함께 지우기에서 할 일·반복 규칙을 묶음으로 지운다([효과](../todo-categories.md#함께-지우기의-효과))                                                                          |
| 할 일 구간 조각   | `todoCountBetween`, `todoCompletionsBetween`, `hasTodoBetween`, `completedTodoCountsByUser`, `todoDaysInPeriodByUser`, `openReminderTodos` | 다른 Context가 사람 id 칸 옆에 그 사람의 할 일(시작일 구간·기간 날 수·끝낸 수·울릴 할 일)을 한 SQL로 붙이는 조건·하위 질의. `planning-todos-queries.public`으로 연다                  |

없거나 남의 할 일이면 모든 행동이 `TODO_0801`이다.

| 상태      | 행동                                                                                       | 다음                                                     | 다시·금지                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 없음      | `Todo.create`                                                                              | 미완료, 단일, 맨 끝 순서                                 | 없거나 남의 카테고리 `TODO_CATEGORY_0851`, 카테고리 한도 `TODO_0811`                                       |
| 미완료    | `complete(timezone, now)`, `updateDetails`의 `completed: true`                             | 완료, `completedAt` = now                                | 이미 완료면 `false`                                                                                        |
| 완료      | `reopen(timezone, now)`, `updateDetails`의 `completed: false`, 하위 항목 더하기(`addItem`) | 미완료, `completedAt` 지움, 시각이 있으면 알림 다시 예약 | 이미 미완료면 `false`                                                                                      |
| 아무 값   | `rename`·`reschedule`·`changeVisibility`·`changeCategory`                                  | 새 값                                                    | 같은 값이면 `false`. 옮길 카테고리가 꽉 차면 `TODO_0811`                                                   |
| 아무 값   | `updateDetails(patch, timezone, now)`                                                      | 보낸 칸만 새 값                                          | 모두 같으면 `false`. 검증을 다 통과해야 하나라도 바꾼다                                                    |
| 단일      | 반복 시작(`StartSeriesFromTodoUseCase`)                                                    | 첫 회차(`seriesId`·`occurrenceDate`), id·댓글 유지       | 이미 회차면 `TODO_0845`, 진행 중 반복 상한 `TODO_0842`                                                     |
| 있음      | `markDeleted`(`DeleteTodoUseCase`)                                                         | 없음                                                     | 두 번째 호출은 `false`. 범위 삭제는 아래 반복 표                                                           |
| 하위 항목 | `addItem`·`updateItem`·`removeItem`·`reorderItems`                                         | 끝에 더함·새 값·없음·새 순서                             | 같은 값·같은 순서면 `false`. 상한 `TODO_0821`, 없는 항목 `TODO_0822`, 순서 id가 빠지거나 겹치면 `SYS_0002` |

## todo-series

| 용어             | 코드                                                                      | 뜻                                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 반복 할 일       | `TodoSeries`(Aggregate, slice `todo-series`), `TodoSeriesId`              | 반복 규칙과 다음 회차 커서를 가진 반복 하나. 회차는 일반 할 일 행이고 DB 칸·출시 앱 응답 이름은 `recurrenceGroupId`다                   |
| 반복 규칙        | `RepeatRule`(VO), `RepeatSpec`                                            | 매일·매주(1·2주 간격, 요일)·매월(날짜, 없는 날은 말일)과 끝(NEVER·UNTIL·COUNT). 틀리면 `TODO_0845`, 맞는 날짜가 없으면 `TODO_0843`      |
| 회차             | `occurrenceDate`, `TodoOccurrenceDraft`                                   | 규칙이 정한 날짜 하나의 할 일. 그 할 일의 날짜를 옮겨도 회차 날짜는 그대로다                                                            |
| 커서             | `nextOccurrenceDate`, `generatedCount`                                    | 다음에 만들 회차 날짜와 만든 수. 커서가 없으면 끝난 반복이다                                                                            |
| 진행 중          | `isActive()`, `countActiveByUserId`                                       | 커서가 남은 반복. 상한 `TODO_SERIES_LIMITS.MAX_ACTIVE_PER_USER`(`TODO_0842`)와 개요의 `hasActiveRepeat`이 이 기준이다                   |
| 회차 채우기      | `planOccurrences`, `MaterializeDueTodoSeriesUseCase`, `occurrenceHorizon` | 규칙 시간대의 오늘 + `VISIBLE_AHEAD_DAYS`까지 회차를 미리 만든다. 밤 작업과 복귀 경로가 같은 저장 규칙을 쓴다                           |
| 체크리스트       | `checklistTemplate`, `replaceChecklist`                                   | 회차마다 하위 항목으로 복사하는 제목 목록. 상한은 하위 항목과 같다(`TODO_0821`)                                                         |
| 이후 모두 고치기 | `UpdateFollowingTodosUseCase`, `applyDetails`, `replaceRule`              | 이 회차와 뒤 미완료 회차를 함께 고친다. 완료한 회차는 기록이라 두고, 규칙이 바뀌면 이 회차에서 나눈다                                   |
| 나누기           | `splitFrom`, `originSeriesId`                                             | 기준 회차부터 새 규칙으로 잇고 앞 규칙은 전날로 끝낸다. 원본 id가 같은 구간은 사용자에게 반복 하나다                                    |
| 반복 끝내기      | `stopAfter`, `StopTodoSeriesUseCase`                                      | 이 회차 뒤로 만들지 않고 뒤 미완료 회차를 지운다. 나뉜 뒤 구간까지 끝낸다                                                               |
| 휴면             | `isSeriesOwnerDormant`, `skipDormantGap`                                  | 오래 앱을 열지 않은 무료 소유자의 반복은 채우기를 멈춘다. 반복의 상태가 아니라 소유자 판정이다([휴면·복귀](../todo-series-dormancy.md)) |
| 복귀             | `CatchUpTodoSeriesUseCase`                                                | 목록·요약·개요 조회 앞에서 커서가 오늘을 못 넘은 반복을 오늘부터 채운다. 지난 날은 만들지 않는다                                        |
| 지난 회차 상한   | `assertWithinPastLimit`                                                   | 새 반복이 지난 날짜로 만들 회차 수 상한. 넘으면 `TODO_0845`(`startDate`)                                                                |

반복이 아닌 할 일에 범위·끝내기를 고르면 `TODO_0844`, 없거나 남의 반복이면 `TODO_0841`이다. 범위 삭제(`DeleteTodoOccurrencesUseCase`)는 THIS_AND_FOLLOWING이면 뒤 구간을 `stopAfter`로 끝내고 미완료 회차만, ALL이면 같은 원본의 구간·회차를 완료까지 모두 지운다.

| 상태                 | 행동                                              | 다음                                                    | 다시·금지                                                          |
| -------------------- | ------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------ |
| 없음                 | `TodoSeries.create`                               | 진행 중, 커서 = 첫 회차                                 | 맞는 날짜 없음 `TODO_0843`. 진행 중 상한은 UseCase의 `TODO_0842`   |
| 진행 중              | `planOccurrences(through, limit)`                 | 커서가 만든 회차 뒤로. 남은 날이 없으면 끝남            | 끝났거나 만들 날이 없으면 빈 목록                                  |
| 진행 중, 커서 < 오늘 | `skipDormantGap(now)`                             | 커서 = 오늘 이후 첫 회차(COUNT 날짜가 다 지났으면 끝남) | 커서가 오늘 이후면 `false`                                         |
| 진행 중              | `stopAfter(date)`                                 | 끝남, 규칙 끝 = date                                    | 이미 끝났으면 `false`. 반복 끝내기는 이를 `TODO_0846`으로 거절한다 |
| 진행 중              | `splitFrom({ pivotDate, changes, id, now })`      | 이 구간은 끝남, 새 구간 진행 중                         | —                                                                  |
| 아무 상태            | `replaceRule(rule)`                               | 진행 중, 커서·만든 수를 처음부터                        | 같은 규칙이면 `false`, 맞는 날짜 없음 `TODO_0843`                  |
| 아무 상태            | `applyDetails(changes)`·`replaceChecklist(items)` | 새 제목·카테고리·공개·시각·체크리스트                   | 같은 값이면 `false`                                                |

## todo-categories

| 용어          | 코드                                                                                   | 뜻                                                                                                                                   |
| ------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 카테고리      | `TodoCategory`(Aggregate, slice `todo-categories`), `TodoCategoryId`                   | 할 일을 묶는 사용자별 이름·색. 할 일과 반복은 모두 카테고리 하나에 속한다                                                            |
| 이름          | `CategoryName`(VO)                                                                     | 1~50자. 같은 사용자 안에서 겹치면 `TODO_CATEGORY_0853`                                                                               |
| 색            | `CategoryColor`(VO)                                                                    | `#RRGGBB`. 아니면 `SYS_0002`                                                                                                         |
| 기본 카테고리 | `DEFAULT_CATEGORIES`, `TodoCategoryProvisionerPort.seed`                               | 가입 트랜잭션에서 가입 언어로 두 개를 만든다. 이름은 사용자 데이터라 언어를 바꿔도 다시 쓰지 않는다                                  |
| 카테고리 한도 | `TodoCategoryLimitReaderPort`, `todoCategoryLimitReached`                              | 요금제 보유 개수(null은 무제한). 생성 잠금 아래에서 캐시 없이 읽고 넘으면 `TODO_CATEGORY_0857`                                       |
| 순서          | `sortOrder`, `planReorderRelativeTo`·`planReorderToEdge`, `ReorderTodoCategoryUseCase` | 0부터 빈틈없는 정수. 옮기면 사이 카테고리를 한 칸씩 민다. 할 일 순서(간격 정수)와 다르다                                             |
| 소유 확인     | `CategoryOwnershipPort`, `TodoCategoryReaderPort.validateOwnership`                    | 할 일·반복을 쓰기 전에 본다. 없거나 남의 카테고리면 `TODO_CATEGORY_0851`                                                             |
| 지우기        | `planCategoryDeletion`, `DeleteTodoCategoryUseCase`, `CategoryTodoHandling`            | 안의 할 일·진행 중 반복을 옮기거나(`move`) 함께 지운다(`delete`). 비었으면 그냥 지운다([삭제 흐름](../todo-categories.md#삭제-흐름)) |
| 삭제 미리보기 | `GetTodoCategoryDeletionPreviewUseCase`                                                | 잠그지 않고 센 할 일·완료·진행 중 반복 수와 마지막 카테고리인지                                                                      |

| 상태 | 행동                                      | 다음       | 다시·금지                                                                                                                      |
| ---- | ----------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 없음 | `TodoCategory.create`                     | 맨 끝 순서 | 한도 `TODO_CATEGORY_0857` → 이름 겹침 `TODO_CATEGORY_0853`                                                                     |
| 있음 | `updateDetails({ name, color }, now)`     | 새 이름·색 | 같은 값이면 `false`, 이름 겹침 `TODO_CATEGORY_0853`                                                                            |
| 있음 | 순서 바꾸기(`ReorderTodoCategoryUseCase`) | 새 순서    | 기준이 자기 자신이면 그대로                                                                                                    |
| 있음 | 지우기(`DeleteTodoCategoryUseCase`)       | 없음       | 마지막 하나 `TODO_CATEGORY_0854` → 할 일이 있는데 옮길 곳 없음 `TODO_CATEGORY_0855` → 같은 곳·함께 지우기에 옮길 곳 `SYS_0002` |

## 이벤트

Aggregate 안 이벤트는 `<aggregate>.<과거형>`이다. 같은 트랜잭션의 `ApplyTodoEventsUseCase`가 리마인더를 예약·취소하고, 다른 Context로 내보내는 `planning.<aggregate>.<과거형>`으로 바꾼다. 이름 목록은 `TODO_CHANGE_EVENT_NAMES`·`TODO_SERIES_CHANGE_EVENT_NAMES`·`CATEGORY_CHANGE_EVENT_NAMES`이고 구독자는 insights 일일 완료 캐시다. durable 구독 이름이라 바꾸지 않는다.

| 안 이벤트                                  | 내는 곳                                                                                            | 내보내는 이벤트                                    | 리마인더                                            |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------- |
| `todo.created`                             | `Todo.create`                                                                                      | `planning.todo.created`                            | 시각이 있으면 예약                                  |
| `todo.toggled`                             | `complete`·`reopen`(일반 PATCH의 완료 칸 포함)                                                     | `planning.todo.completed`·`planning.todo.reopened` | 완료면 취소                                         |
| `todo.updated`                             | `rename`, `updateDetails`(완료가 아닌 칸)                                                          | `planning.todo.updated`                            | 완료 상태면 취소                                    |
| `todo.rescheduled`                         | `reschedule`, `updateDetails`(시각이 바뀜), 되돌리기                                               | `planning.todo.rescheduled`                        | 새 시각으로 예약, 시각이 없거나 끝낸 할 일이면 취소 |
| `todo.visibility-changed`                  | `changeVisibility`                                                                                 | `planning.todo.visibility-changed`                 | —                                                   |
| `todo.category-changed`                    | `changeCategory`                                                                                   | `planning.todo.category-changed`                   | —                                                   |
| `todo.deleted`                             | `markDeleted`                                                                                      | `planning.todo.deleted`                            | 취소                                                |
| `todo.occurrences-created`                 | `TodoSeries.planOccurrences`(커서가 움직였을 때)                                                   | `planning.todo-series.occurrences-created`         | UseCase가 묶음으로 예약                             |
| `todo.occurrences-changed`                 | `TodoSeries.stopAfter`·`applyDetails`·`replaceRule`·`replaceChecklist`·`markDeleted`(규칙당 한 번) | `planning.todo-series.occurrences-changed`         | UseCase가 지운 회차를 취소                          |
| `planning.todo-category.updated`·`deleted` | `TodoCategory.updateDetails`·`markDeleted`(안에서 쓰는 곳이 없어 내보내는 이름 그대로 낸다)        | 같음                                               | —                                                   |

- `PATCH /v1/todos/:id`의 `completed`도 `complete`·`reopen`을 거쳐 `planning.todo.completed`·`reopened`와 완료 효과를 낸다. 다른 칸도 함께 바꿨으면 `planning.todo.updated`가 먼저 나간다.
- 카테고리 함께 지우기는 할 일마다 `planning.todo.deleted`를 내지 않고 `planning.todo-category.deleted` 하나로 알린다.

## 다른 Context와의 문

| 포트                                                                                 | 뜻                                                                         | 쓰는 Context              |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ------------------------- |
| `StagedTodoCreatorPort`                                                              | 활성 UoW와 생성 잠금 안에서 할 일을 만든다. 돌려받은 효과는 커밋 뒤에 낸다 | notes·voice·ai-assistance |
| `TodoPlanReaderPort`, `TodoCategoryReaderPort`                                       | 계획에 쓰는 다가오는 할 일(반복은 다음 회차 하나)과 카테고리               | voice·ai-assistance       |
| `TodoDetailsReaderPort`, `TodoEngagementCounterPort`, `TodoViewCacheInvalidatorPort` | 댓글 화면의 할 일, 할 일 행의 댓글·조회 수                                 | engagement                |
| `TodoCompletionGroupReaderPort`                                                      | 날짜별로 펼칠 할 일 묶음                                                   | insights                  |
| `TodoScheduleReaderPort`                                                             | 그날 시각 있는 미완료 할 일                                                | weather·notification      |
| `RepeatingTodoTitleReaderPort`, `SingleTodoCountReaderPort`                          | 진행 중 반복 제목, 기간에 시작한 단일 할 일 수                             | ai-assistance             |
| `TodoBriefReaderPort`                                                                | 콕 대상 할 일 요약(id 묶음·주인 행 잠금), 그날 할 일 수                    | social                    |
| `TodoActivationReaderPort`                                                           | 사용자별 구간 안에 할 일을 만들고 완료한 사용자                            | identity                  |
| `TodoCategoryProvisionerPort`, `TodoTimezoneRebaseQueueService`                      | 가입 때 기본 카테고리, 시간대 변경 뒤 재계산 작업                          | identity                  |
| `TodoCategoryCountReaderPort`                                                        | 지금 가진 카테고리 수                                                      | access                    |
| `isSeriesOwnerDormant`                                                               | 반복 회차 알림을 보낼지 정하는 휴면 판정                                   | notification              |

planning이 부르는 쪽은 `StreakPort`·`TodoOwnerTimezonePort`(identity), `FriendPort`(social), `TodoNotificationPort`·`TodoReminderSchedulerPort`(notification), `TodoCategoryLimitReaderPort`(access), `TodoSeriesOwnerPort`(identity·access)다.
