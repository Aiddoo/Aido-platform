# 할 일 카테고리

카테고리 삭제의 규칙·부수효과·잠금·성능을 바꿀 때 읽는다. 계약은 `@aido/api/contracts/todo-category/v1`, 호환 범위는 [호환](../../../docs/conventions/compatibility.md)이다.

## 삭제 흐름

| 요청                                               | 동작                                                                                 |
| -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `GET /v1/todo-categories/:id/deletion-preview`     | 할 일·완료·진행 중 반복 수와 마지막 카테고리 여부(잠그지 않는 조회)                  |
| `DELETE …/:id` (출시 앱, `todoHandling` 없음)      | 할 일·진행 중 반복이 있으면 `moveToCategoryId`로 옮긴다. 없으면 `TODO_CATEGORY_0855` |
| `DELETE …/:id?todoHandling=move&moveToCategoryId=` | 옮긴 뒤 삭제                                                                         |
| `DELETE …/:id?todoHandling=delete`                 | 할 일·반복 규칙과 함께 삭제                                                          |

- 판단은 [planCategoryDeletion](../src/modules/planning/todo-categories/domain/category-deletion.domain-service.ts) 한 곳이고, 거절 이유는 `todo-categories.errors.ts`가 출시 앱이 받던 코드(`0854`·`0855`·`SYS_0002`)와 details로 바꾼다. 빈 카테고리는 옮길 곳을 보지 않고 지운다(1.15.0과 같다).
- 순서는 잠금 → 읽기 → 계획 → 실행 → 발행이다. 응답 `result`의 수는 잠금 아래에서 읽은 값이다.
- 로그는 `planning.category.deleted`(`todoHandling`·`todoCount`·`seriesCount`·`durationMs`)다. 이름·제목은 남기지 않는다.

## 잠금

- 삭제는 `TodoCategoryLockKeys.userCategories`와 `TodoLockKeys.sortOrder`를 잡는다. 할 일 생성·카테고리 이동·메모/음성/AI 변환·반복 수정은 카테고리 잠금을, 반복 회차 채우기는 정렬 잠금을 먼저 잡으므로 삭제 중인 카테고리에 할 일이 새로 들어오지 않는다.
- 할 일 하나만 고치는 요청(제목·완료·일정·하위 항목)은 할 일 잠금을 잡고 그 행을 잠가 읽는다(`lockByIdAndUserId`). 삭제는 할 일마다 advisory 잠금을 잡지 않고 집합 `DELETE`·`UPDATE`의 행 잠금에 맡긴다. 기다린 수정은 커밋 뒤 행을 찾지 못해 `TODO_0801`로 끝나고, 옮기기를 기다린 수정은 새 카테고리 위에 저장한다. 할 일 `save`는 있는 행만 고치는 `UPDATE`라 지운 행을 되살리지 못한다. 5,000개를 advisory로 잡으면 공유 잠금 표(`max_locks_per_transaction` × 연결 수)를 거의 채운다.

## 함께 지우기의 효과

todos slice의 [RemoveCategoryTodosUseCase](../src/modules/planning/todos/application/use-cases/remove-category-todos.use-case.ts)가 단건 삭제와 같은 효과를 묶음으로 낸다. 할 일 기능 Module이 내보내고 카테고리 기능 Module이 import한다.

| 효과                              | 방식                                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 할 일·반복 규칙                   | `(userId, categoryId)` 조건의 집합 `DELETE` 두 문장                                                                       |
| 하위 항목·댓글·좋아요·조회·찌르기 | FK cascade                                                                                                                |
| 앞으로의 회차                     | 규칙 행이 없어 회차 채우기가 `lockForUpdate`에서 건너뛴다                                                                 |
| 리마인더                          | 시각이 있던 할 일의 결정적 작업 id를 같은 트랜잭션에서 한 번에 지운다. 처리기도 없는 할 일은 `TODO_INACTIVE`로 건너뛴다   |
| 다른 Context                      | `planning.todo-category.deleted` 하나. 할 일 삭제 이벤트 구독자는 insights 일간 완료 캐시뿐이고 같은 사용자 캐시를 지운다 |
| 친구 화면 캐시                    | 커밋 뒤 `invalidateFriendTodos`                                                                                           |
| 알림함                            | `Notification.todoId`는 FK가 없어 남는다. 앱이 열면 `TODO_0801`(404) 없음 화면이다(단건 삭제와 같다)                      |

- 날짜별 완료(`GET /v1/daily-completions`)는 할 일 행에서 바로 세므로 함께 지운 완료 할 일은 달력에서 빠진다. 연속 기록(`UserPreference.currentStreak`)과 지난 주간 성취(`WeeklyAchievement`)는 저장된 값이라 바뀌지 않는다. 앱은 미리보기의 `completedTodoCount`로 먼저 알린다.
- 다른 카테고리로 옮겨 둔 같은 반복의 회차는 남고, 규칙이 없는 묶음(`recurrenceGroupId`만 있는 할 일)이 된다.

## 캐시

- 친구 화면 할 일 캐시(`todo:friend-view-v2:{owner}:{generation}`, 60초)는 할 일마다 카테고리 이름·색·순서를 담고 그 순서로 정렬한다. 이름·색 수정, 재정렬, 옮겨 지우기, 함께 지우기는 같은 트랜잭션에서 `AfterCommitTaskRegistryPort`에 `invalidateFriendTodos`를 등록해 커밋 뒤 지운다. 빈 카테고리 삭제는 친구 화면에 없어 건너뛴다.
- 카테고리 목록 캐시(`todo-category:list:{userId}`)는 카테고리 쓰기와 `todoCount`를 바꾸는 할 일 쓰기(만들기·고치기·옮기기·지우기·반복 편집)가 UoW를 마친 뒤 세대(`todo-category:list-generation:{userId}`)를 바꾸고 지운다. 할 일 쓰기는 카테고리 slice의 `TodoCategoryCachePort.invalidate`를 거쳐 커밋 전에 센 목록을 다시 저장하지 않는다.

## 성능

옮기기·함께 지우기는 요청 안에서 동기로 끝내고 별도 정리 작업·경보를 두지 않는다. [category-deletion.performance-spec](../test/performance/category-deletion.performance-spec.ts)이 큰 카테고리(데이터 크기는 spec)를 넣고 두 경로의 시간과 SQL 문장 수를 잰다. 삭제 쿼리를 바꾸면 이 spec을 다시 돌리고 결과는 PR에 적는다.
