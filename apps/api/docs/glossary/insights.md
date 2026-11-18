# insights 용어집

일일 완료·주간 성취 기능을 설계·리뷰할 때 읽는다. 쓰는 법은 [용어집](../glossary.md)이다.

할 일을 얼마나 끝냈는지 날짜·주 단위로 보여 준다. 두 Aggregate 모두 상태 전이가 없다. 일일 완료 현황은 조회마다 planning 할 일로 다시 세고, 주간 성취는 다시 기록하면 할 일 수·달성 시각만 덮어쓴다. 하루 단위 연속 기록(`UserPreference.currentStreak`)은 identity가 소유한다.

| 용어     | 코드                                                | 뜻                                                                                                                                               |
| -------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 할 일 수 | `TodoCompletionCount`(VO, `insights/shared/domain`) | 한 기간의 할 일 수와 그중 끝낸 수. 0 이상 정수이고 끝낸 수는 전체를 넘지 않는다(아니면 `SYS_0002`)                                               |
| 완료율   | `completionRate`, `TodoCompletionCount.rate`        | `@aido/api/vocabulary` `completionRate`. 끝낸 수 ÷ 할 일 수를 반올림한 0~100. 다 끝냈을 때만 100, 하나라도 끝냈으면 1 이상, 할 일이 없으면 0이다 |

## daily-completions

| 용어           | 코드                                                                        | 뜻                                                                                                                                                                                                                                                                         |
| -------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 일일 완료 현황 | `DailyCompletion`(Aggregate), `GetDailyCompletionsUseCase`                  | 한 사용자의 하루 할 일 수·끝낸 수·카테고리 색. 할 일이 있는 날만 있다. 생성만 하는 Aggregate라 조회마다 세고 저장·복원하지 않는다                                                                                                                                          |
| 조회 구간      | `DateRange`(VO)                                                             | 양 끝을 포함한 달력 날짜. 앱이 보낸 날짜 그대로이고 시작이 끝보다 늦으면 `SYS_0002`다                                                                                                                                                                                      |
| 그날의 할 일   | `tallyDailyCompletions`, `TodoCompletionGroup`, `CompletionGroupReaderPort` | 시작일 ≤ 그날 ≤ 종료일(없으면 시작일)인 할 일. planning 조회 포트로 구간에 걸친 할 일 묶음을 받아 여러 날 할 일은 구간 안의 모든 날에 센다. 앱이 하루를 고친 뒤 직접 고치는 달력 값과 같은 규칙이라 `packages/api/test/fixtures/daily-completion-cases.json`을 함께 읽는다 |
| 완료한 날      | `isComplete()`                                                              | 할 일이 하나 이상이고 모두 끝낸 날(달력의 물고기). planning의 "완료"는 할 일 하나의 상태다                                                                                                                                                                                 |
| 완료일 수      | `totalCompleteDays`, `countCompleteDays`                                    | 구간 안 완료한 날의 수                                                                                                                                                                                                                                                     |
| 카테고리 색    | `categoryColors`                                                            | 그날 할 일의 카테고리 색. 중복 없이 문자열 오름차순(앱 정렬과 같다)                                                                                                                                                                                                        |
| 친구 완료 현황 | `GetFriendDailyCompletionsUseCase`, `listPublicByDateRange`                 | 맞팔 친구(`FriendshipReaderPort`)의 공개 할 일만 센 현황. 맞팔이 아니면 날짜를 보기 전에 `FOLLOW_0906`이다                                                                                                                                                                 |
| 구간 현황      | `DailyCompletionRangeReadModel`                                             | 날짜별 현황·완료일 수·조회 구간. 캐시에 담는 값이고 응답 매퍼가 응답 계약으로 바꾼다                                                                                                                                                                                       |
| 캐시 세대      | `DailyCompletionCache`, `DailyCompletionCacheKey.generation`                | 사용자별 본인·공개 현황 캐시의 namespace. planning 할 일·회차·카테고리 이벤트가 커밋되면 세대를 바꿔 모두 버린다                                                                                                                                                           |

`DailyCompletion` 테이블은 이 slice와 관계없다. insights는 읽지도 쓰지도 않고(운영 0행) ai-assistance 제안 활동 Reader만 읽어, Context 경계 층이 그 읽기를 옮긴 뒤 두 릴리스에 걸쳐 지운다([영속성](../persistence.md#마이그레이션)).

## weekly-achievements

| 용어         | 코드                                                                            | 뜻                                                                                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 주간 성취    | `WeeklyAchievement`(Aggregate), `WeeklyAchievementId`                           | 지난 한 주(월~일)의 할 일 수·끝낸 수. 사용자·주마다 하나다                                                                                                                                  |
| ISO 주       | `IsoWeek`(VO)                                                                   | 월요일에 시작하는 연도·주 번호. 주는 1부터 그해 주 수(52·53, Temporal `weekOfYear`)까지이고 그 밖은 `SYS_0002`다(2027년 53주는 없다). 상세 조회에서 없는 주는 `ACHIEVEMENT_1801`이다        |
| 기록         | `RecordWeeklyAchievementsUseCase`, `WeeklyAchievementWriterPort.record`         | notification 주간 리마인더가 센 값(`WeeklyAchievementTally`)을 남긴다. 같은 사용자·주는 처음 id를 두고 덮어쓴다                                                                             |
| 달성 시각    | `achievedAt`                                                                    | 그 주를 센 시각. 다시 기록하면 바뀐다                                                                                                                                                       |
| 완벽한 주    | `isPerfect()`, `perfectWeeks`, `weeklyAchievementBadge`(`@aido/api/vocabulary`) | 할 일이 하나 이상이고 모두 끝낸 주. 배지(perfect·almost·completed)는 할 일 수로 정하는 vocabulary 함수 하나를 앱 배지·주간 푸시·`isPerfect`가 함께 쓴다(끝내지 않은 주의 완료율은 99% 상한) |
| 연속 주      | `computeWeeklyStreak`, `currentStreak`                                          | 기록이 있는 주가 끊김 없이 이어진 수. 해가 바뀌어도 끊지 않고(52·53주 → 다음 해 1주) 앞 해에서 이어 온 주까지 센다. `currentStreak`는 그해 가장 최근 기록부터 센다                          |
| 최고 연속    | `bestStreak`                                                                    | 그해 안에서 끝난 연속 중 가장 긴 것(앞 해에서 이어 온 주 포함). 그래서 `currentStreak`보다 작지 않고 지난해 값은 새해 기록으로 바뀌지 않는다                                                |
| 연도 요약    | `summarizeWeeklyAchievements`, `averageRate`, `listThroughYear`                 | 페이지와 상관없이 그해 기록 전부로 센 주 수·완벽한 주·주별 완료율의 반올림 평균과 연속 주. 연속 주를 세려고 앞 해 기록까지 읽는다                                                           |
| 기록 있는 해 | `ListWeeklyAchievementYearsUseCase`, `listRecordedYears`                        | 기록이 하나라도 있는 ISO 연도(최근 해 먼저, `GET /v1/weekly-achievements/years`). 앱은 고르지 않으면 가장 최근 해를 보여 해가 바뀐 직후에도 지난해 53주를 본다                              |
| 주차 라벨    | `weekLabel`, `localToday`, `AchievementOwnerTimezoneReaderPort`                 | 응답 매퍼가 만드는 "3월 2주차". 사용자 저장 시간대의 오늘로 올해를 정하고 다른 해의 주는 연도를 붙인다                                                                                      |
| 없는 주      | `weeklyAchievementNotFound`                                                     | 요청한 사용자의 그 주 기록이 없으면 `ACHIEVEMENT_1801`이다                                                                                                                                  |
