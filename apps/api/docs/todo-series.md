# 반복 할 일

반복 규칙·회차 생성·수정 범위를 바꿀 때 읽는다. 휴면·복귀는 [휴면 규칙](todo-series-dormancy.md), 시각 계산은 [떠 있는 시각](todo-floating-time.md)에 있다.

규칙은 `TodoSeries`(Aggregate)와 `RepeatRule`(VO)이 소유하고, 회차는 일반 `Todo` 행이다. 코드 이름은 `seriesId`이고 DB 칸과 출시 앱 응답은 `recurrenceGroupId` 그대로다.

| 항목      | 규칙                                                                                                                                                                                                                   |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 값        | 빈도 `TODO_REPEAT_FREQUENCIES`, 간격 `TODO_REPEAT_INTERVALS`, 끝 `TODO_REPEAT_END_TYPES`(`NEVER`·`UNTIL`·`COUNT`), 수정 범위 `TODO_EDIT_SCOPES`(`THIS_ONLY`·`THIS_AND_FOLLOWING`·`ALL`). 모두 `@aido/api/vocabulary`다 |
| 상한      | `TODO_SERIES_LIMITS`: 진행 중 규칙 30개(`TODO_0842`), `COUNT` 365회. 성능 한도라 등급과 상관없이 같다. 옛 경로는 [호환](../../../docs/conventions/compatibility.md)의 300개다                                          |
| 회차 생성 | 규칙 시간대의 오늘 + `VISIBLE_AHEAD_DAYS`(90일)까지 미리 만든다(`occurrenceHorizon`). 밤 작업은 `todo-series-materialization.v1`이고 커서는 `nextOccurrenceDate`다                                                     |
| 멱등      | `(seriesId, occurrenceDate)` 유니크 + 잠금 뒤 커서 재확인. 잠금 순서는 `todoCategory → todoSortOrder → 규칙 행 → 할 일 행`이다                                                                                         |
| 시각      | 벽시계에서 계산한다([떠 있는 시각](../../../docs/conventions/dates.md#5-떠-있는-시각)). 사용자 시간대가 바뀌면 규칙 시간대도 바뀐다                                                                                    |
| 만드는 곳 | 손으로 만들기, 메모 변환, 계획 적용, AI 제안 수락이 모두 `StagedTodoCreatorPort.stage`(`StageTodoCreationUseCase`)를 탄다. 경로마다 규칙을 따로 만들지 않는다                                                          |
| 오류      | `TODO_0841`(없음)·`0842`(상한)·`0843`(맞는 날짜 없음)·`0844`(반복 아님)·`0845`(설정 오류)·`0846`(끝남). 공개 상세는 `PUBLIC_ERROR_DETAILS`에 있다                                                                      |

오래 앱을 열지 않은 무료 사용자의 규칙은 멈춘다([휴면·복귀](todo-series-dormancy.md)).

## 전환 중

아직 옮기지 않은 Context는 옛 구조(`modules/<context>/<layer>/<slice>`)라 위 이름·경로가 지금 코드와 같다. 새 구조의 경로·이름은 [아키텍처](architecture.md)와 [이름 사전](conventions.md)을 따른다.
