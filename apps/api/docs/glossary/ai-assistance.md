# ai-assistance 용어집

AI 제안과 제안 분석 실행을 설계·리뷰할 때 읽는다. 쓰는 법은 [용어집](../glossary.md)이다.

suggestions slice가 사용자의 최근 할 일 기록에서 반복할 만한 활동을 찾아 제안하고, 사용자가 수락하면 planning이 반복 할 일을 만든다. 분석은 사용자당 현지 날짜마다 한 번이다.

| 용어        | 코드                                                                   | 뜻                                                                                                                                                                        |
| ----------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI 제안     | `Suggestion`(Aggregate), `SuggestionId`                                | 반복 할 일로 만들 만한 활동 하나. 만든 뒤 `AI_SUGGESTION_LIMITS.SUGGESTION_EXPIRY_DAYS`(14일)에 만료된다                                                                  |
| 반복 할 일  | `HandleSuggestionActionUseCase`, `StagedTodoCreatorPort`               | 제안을 수락하면 같은 트랜잭션에 planning이 만드는 `DEFAULT_RECURRING_WEEKS`(4주)짜리 반복 할 일. 사용자 문구도 "루틴" 대신 이 말을 쓴다                                   |
| 같은 활동   | `toActivityKey`, `isMeaningfulTitle`                                   | 띄어쓰기·문장부호·이모지·전각·대소문자만 다른 제목. 한 후보로 세고 가장 많이 쓴 제목을 보인다. 오타는 다른 활동이다. 자모·숫자·기호뿐인 제목은 세지 않는다                |
| 반복 중     | `RepeatingTodoTitleReaderPort`(planning)                               | 더 만들 회차가 남은 반복 할 일. 같은 활동은 후보에서 뺀다                                                                                                                 |
| 근거        | `SuggestionEvidence`(VO), `evidence`                                   | 기간(`periodDays`일) 안에 그 활동을 적은 횟수(`recordedCount`)와 그중 끝낸 횟수(`completedCount`). 근거를 남기기 전에 만든 제안은 `null`                                  |
| 근거 불변식 | `SuggestionEvidence.create`, `invalidSuggestionEvidence`               | 1 ≤ 적은 횟수, 1 ≤ 기간, 0 ≤ 끝낸 횟수 ≤ 적은 횟수. 서버가 기록에서 센 값이라 어긋나면 집계 버그로 `SYS_0001`이다. 저장된 값은 검증하지 않는다                            |
| 분석 실행   | `SuggestionAnalysisRun`(Entity), `SuggestionAnalysisRunRepositoryPort` | 사용자당 한 행인 작업 원장. 마지막으로 요청받은 현지 날짜(`localDate`)와 상태·결과·시각을 남긴다                                                                          |
| 트리거      | `SuggestionAnalysisTrigger`                                            | `SCHEDULED`(아침 배치)·`ON_DEMAND`(사용자가 지금 요청)                                                                                                                    |
| 분석 결과   | `SuggestionAnalysisOutcome`                                            | 끝난 실행의 결과. 제안을 만듦·최근 할 일 없음·패턴 없음·동의 없음·프리미엄 아님·AI 사용 불가·비용 한도·실패                                                               |
| 멈춘 실행   | `isRunning(now)`, `RUN_STALE_AFTER_MINUTES`                            | 큐에 넣은 지 60분이 넘도록 끝나지 않은 실행. 분석 중으로 보지 않는다                                                                                                      |
| 분석 상태   | `resolveSuggestionAnalysisState`, `AI_SUGGESTION_ANALYSIS_STATES`      | 제안 화면 상황. 대기 제안 → 동의 → 최근 단건 할 일 → 분석 중 → 오늘 결과 → 오늘 요청했지만 멈춤(오늘은 못 함) → 기다림 순서로 먼저 맞는 하나다. 앱은 다시 계산하지 않는다 |
| 아침 배치   | `DispatchSuggestionAnalysesUseCase`                                    | 현지 09시대 사용자 묶음을 한 트랜잭션에서 잠그고 오늘 요청받지 않은 사람만 기록·큐에 넣는다                                                                               |
| 다음 분석   | `nextSuggestionDispatchAt`                                             | 저장 시간대의 다음 09:00 순간. 오늘 09:00이 지났으면 내일이다                                                                                                             |

## AI 제안 전이

| 상태      | 행동           | 다음        | 그 밖                                                             |
| --------- | -------------- | ----------- | ----------------------------------------------------------------- |
| 없음      | `create`       | `PENDING`   | —                                                                 |
| `PENDING` | `accept(now)`  | `ACCEPTED`  | 이미 처리했으면 `AI_1306`, 만료됐으면 `AI_1307`(처리 오류가 먼저) |
| `PENDING` | `dismiss(now)` | `DISMISSED` | 위와 같다                                                         |

## 분석 실행 전이

날짜는 사용자 저장 시간대의 현지 날짜다. 해외로 옮겨 현지 날짜가 바뀌면 저장된 날짜와 다른 날로 본다.

| 상태                       | 행동                               | 다음                       | 반환    |
| -------------------------- | ---------------------------------- | -------------------------- | ------- |
| 없음                       | `create`                           | `QUEUED`                   | —       |
| 다른 날의 아무 상태        | `request(localDate, trigger, now)` | `QUEUED`(결과·시각을 비움) | `true`  |
| 같은 날의 아무 상태        | `request`                          | 그대로                     | `false` |
| 같은 날 `QUEUED`           | `start(localDate, now)`            | `RUNNING`                  | `true`  |
| `RUNNING`(재시도)·다른 날  | `start`                            | 그대로                     | `false` |
| 같은 날 `QUEUED`·`RUNNING` | `finish(localDate, result, now)`   | `FINISHED`                 | `true`  |
| `FINISHED`·다른 날         | `finish`                           | 그대로                     | `false` |

`false`면 저장하지 않는다.
