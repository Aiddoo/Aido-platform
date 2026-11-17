# ai-assistance 용어집

AI 생성·파싱·계획 초안·리포트·제안과 제안 분석 실행을 설계·리뷰할 때 읽는다. 쓰는 법은 [용어집](../glossary.md)이다.

## slice와 Aggregate

| slice                | Aggregate                 | 뜻                                                                                                                                                  |
| -------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ai-generations`     | `AiGeneration`(생성만)    | 업체가 작업의 출력 모양으로 답한 생성 한 건. 응답 업체는 시도 경로(`route`) 안에 있고, 경로의 첫 업체가 아니면 그 업체에서 넘어왔다(`fallbackFrom`) |
| `parsed-drafts`      | `ParsedDraft`(생성만)     | 글·메모를 할 일로 바꾼 초안. 할 일 1개 이상 메모 상한 이하, 실행할 할 일이 없으면(`hasAction() = false`) 차감하지 않고 만들지 않은 할 일도 없다     |
| `action-plan-drafts` | `ActionPlanDraft`(생성만) | 말·글에서 만든 실행 계획. 할 일은 계획 상한 이하이고 반복 할 일은 기간(`endDate`)을 쓰지 않는다. 사용량·저장은 voice가 소유한다                     |
| `ai-reports`         | `AiReport`(저장)          | 주기 하나의 분석 결과. 만든 뒤 바뀌지 않는다                                                                                                        |
| `suggestions`        | `Suggestion`(저장)        | 반복 할 일로 만들 만한 활동 하나(아래 표)                                                                                                           |

- 모델 출력은 업체 중립 타입(`AiTaskOutputs`: `TodoDraft`·`MemoDraft`·`QuickPlanDraft`·`VoiceNoteDigestDraft`·`ReportDraft`·`SuggestionDraft`)이고 LLM schema(`*.wire.ts`)는 그것을 파싱하는 `ai-generations` 어댑터 옆에 둔다. 출력 타입은 생성 slice와 정규화하는 slice가 함께 써서 `shared/domain`(`TodoDraft`는 `todo-draft.constants.ts`, 나머지는 `ai-task-outputs.constants.ts`)에 두고, `ai-generations`는 그것을 쓰는 slice를 import하지 않는다.
- `ParsedDraft`·`ActionPlanDraft`는 생성 실패 처리 안에서 만든다. 불변식이 깨지면 `SYS_0001`이 아니라 `AI_1302`(`charged: false`, 환불)다.
- 체인 제한 시간을 나누는 업체별 몫은 설정 `providerTimeWeights`(`ai-assistance-ai-generations.config.ts`)이고 도메인 서비스 `resolveAttemptTime`은 그 몫을 입력으로 받는다.

## 제안

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
| 다음 분석   | `nextSuggestionDispatchAt`                                             | 이 사용자에게 다음 자동 분석이 도는 순간. 오늘 요청 기록이 있거나 오늘 09:00이 지났으면 내일 09:00, 아니면 오늘 09:00이다. 배치가 UTC 정각에 돌아 +5:30은 09:30이다       |

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

`false`면 저장하지 않는다. 같은 날 `FINISHED`인데 같은 job이 다시 오면(`isFinishedOn`) 분석·제안 교체·푸시를 건너뛴다.
