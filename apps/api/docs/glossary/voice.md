# voice 용어집

말로 메모(녹음 정리·할 일 계획 적용) 기능을 설계·리뷰할 때 읽는다. 쓰는 법은 [용어집](../glossary.md)이다.

녹음·짧은 말을 실행 계획으로 정리하고 사용자가 확인한 행동만 저장한다. 서버는 녹음도 전사 글자도 저장하지 않는다.

| 용어        | 코드                                                             | 뜻                                                                                                                        |
| ----------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 전사        | `VoiceTranscript`(VO), `TranscriptSegment`                       | 기기가 글자로 바꾼 녹음 한 건과 문장(`startMs`·`isBookmarked`). 요청을 처리하는 동안만 있다                               |
| 글자 수     | `characterCount`, `exceeds`                                      | 프롬프트에서 길어지는 글자를 늘어난 길이로 센 수. 전체 글자와 문장 합 중 긴 쪽                                            |
| 한 번 상한  | `featureQuota.perUse`, `voiceNoteTooLong`                        | 등급별 녹음 한 번 글자 상한. 넘으면 차감 전에 `AI_1312`. 녹음 길이(초)는 `exceedsDuration`이 경보만 올린다                |
| 녹음 정리   | `DigestVoiceNoteUseCase`                                         | 긴 전사 → 제목·요약·핵심 내용(`keyPoints`)·실행 계획. 돌려줄 내용이 전혀 없을 때만 환불(`EMPTY`)                          |
| 빠른 계획   | `CreateQuickPlanUseCase`                                         | 짧은 말·글(`QUICK_PLAN_SOURCES`) → 실행 계획. 할 일이 없으면 환불(`NO_ACTION`)                                            |
| 실행 계획   | `ActionPlanReadModel`                                            | 사용자에게 보여 줄 할 일·메모 행동(key `todo-<n>`·`memo-0`, `duplicateOfTodoId`, `omittedTodoCount`). 저장하지 않는다     |
| 계획 문맥   | `PlanningContextReaderPort`, `PlanningContextReadModel`          | AI에 주는 카테고리 id·이름과 사용자 시간대 오늘부터의 다가오는 할 일                                                      |
| 차감 실행   | `ChargedPlanRunnerPort`                                          | 사용량을 Idempotency-Key로 예약하고 결과에 따라 확정·환불한다. 같은 키는 한 번만 차감하고 처리 중이면 `AI_1314`           |
| 결과 재생   | `PlanResultReplay`                                               | 응답을 받지 못한 재요청에 돌려줄 결과. 프로세스 메모리에 10분만 두고, 없으면 추가 차감 없이 다시 만든다                   |
| 확인한 계획 | `ActionPlan`(VO), `PlannedTodo`·`PlannedMemo`                    | 사용자가 확인해 적용 API로 보낸 행동. 메모 제목은 내용 첫 줄이 된다(`memoContent`)                                        |
| 계획 적용   | `ApplyActionPlanUseCase`                                         | 확인한 행동을 손으로 만든 것과 같은 경로로 한 UoW에서 저장한다. 차감하지 않고 내 카테고리가 아니면 `AI_1315`              |
| 출처        | `ActionPlanSource`                                               | 계획이 나온 곳(`QUICK_VOICE`·`QUICK_TEXT`·`VOICE_NOTE`·`MEMO`). `MEMO`면 적용에 성공할 때 원본 메모를 지운다              |
| 적용 기록   | `PlanApplication`(Aggregate), `isSameRequest`                    | 적용 한 번의 멱등 기록. 요청 해시(`fingerprintRequest`)와 만든 할 일·메모 id만 두고 만든 뒤 바뀌지 않는다                 |
| 기록 정리   | `PurgePlanApplicationsUseCase`, `planApplicationRetentionCutoff` | `PLAN_APPLICATION_RETENTION_DAYS`(7일)가 지난 적용 기록을 매일 03:20(Asia/Seoul) 한 문장으로 지운다(`purgeCreatedBefore`) |

적용 기록은 바뀌지 않으므로 전이 표는 수명주기다.

| 상태   | 행동                                                | 다음   | 같은 키로 다시                                                               |
| ------ | --------------------------------------------------- | ------ | ---------------------------------------------------------------------------- |
| 없음   | `ApplyActionPlanUseCase` → `PlanApplication.create` | 적용됨 | 같은 계획이면 만들지 않고 처음 결과(그 뒤 지운 할 일·메모는 뺀다)를 돌려준다 |
| 적용됨 | 다른 계획으로 적용                                  | 적용됨 | `AI_1318`(`planRequestMismatch`)                                             |
| 적용됨 | 잠금을 지나 겹친 같은 키 `save`                     | 적용됨 | `AI_1314`(`planApplicationInProgress`), 늦은 UoW는 되돌린다                  |
| 적용됨 | `purgeCreatedBefore`(7일 지남)                      | 없음   | 같은 키가 새 적용이 된다                                                     |
