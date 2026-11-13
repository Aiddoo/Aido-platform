# 도메인 용어집

기능을 설계·리뷰하거나 다른 부서와 같은 말로 이야기할 때 읽는다. Bounded Context마다 업무 용어와 코드 이름, 상태 전이를 한 표로 둔다. 코드 이름은 이 표의 말을 따르고([도메인 모델](domain-modeling.md#상태와-행동-이름)), 표에 없는 새 용어는 그 기능을 더하는 PR이 함께 적는다.

## 쓰는 법

- 용어는 사용자·운영자가 실제로 쓰는 한국어다. 코드 이름은 그 용어의 영어 한 단어(또는 두 단어)이고, Context 안에서 한 용어에 한 이름만 쓴다.
- 같은 낱말이 Context마다 다른 뜻이면 각 Context 절에 따로 적는다(예: planning의 "완료"와 insights의 "완료한 날").
- 상태가 있는 Aggregate는 전이 표를 둔다. 행동은 Aggregate 메서드 이름, 결과는 `true`(바뀜)·`false`(이미 그 상태)·오류다.

## notes (기준 구현)

| 용어                | 코드                                                  | 뜻                                                                                                                          |
| ------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 메모                | `Memo`(Aggregate)                                     | 사용자가 할 일로 바꾸기 전에 적어 두는 글                                                                                   |
| 메모 내용           | `MemoContent`(VO)                                     | 1자 이상 `MEMO_LIMITS.MAX_CONTENT_LENGTH`자 이하의 글. 할 일 제목은 그 앞 `TODO_LIMITS.TITLE_MAX_LENGTH`자다(`toTodoTitle`) |
| 메모 한도           | `MEMO_LIMITS.MAX_PER_USER`, `memoLimitReached`        | 사용자당 메모 수 상한. 넘으면 내용 검증보다 먼저 `MEMO_2003`                                                                |
| 만들기              | `Memo.create`, `CreateMemoUseCase`                    | 그 사용자 마지막 순서 다음에 고정하지 않은 메모를 만든다                                                                    |
| 생성 요청           | `MemoCreationRequest`(VO), `isSameCreationRequest`    | 앱이 저장 한 번마다 보내는 Idempotency-Key와 글의 해시. 같은 키면 처음 메모를 돌려주고 글이 다르면 `MEMO_2004`              |
| 다시 쓰기           | `rewrite`, `RewriteMemoUseCase`                       | 메모 내용을 바꾸는 행동(API는 "메모 수정")                                                                                  |
| 고정                | `isPinned`, `changePinned`, `ChangeMemoPinnedUseCase` | 목록 맨 위에 두는 표시                                                                                                      |
| 순서                | `sortOrder`, `moveTo`, `ReorderMemoUseCase`           | 고정 안에서·밖에서 사용자가 정한 위치. 기준 메모 앞·뒤나 맨 앞·뒤로 옮기고 사이 메모를 한 칸씩 민다                         |
| 메모 잠금           | `MemoLockKeys.existingMemo`                           | 있는 메모를 바꾸는 요청이 함께 잡는 메모·순서 두 키                                                                         |
| 할 일로 바꾸기      | `ConvertMemoToTodoUseCase`                            | 메모 내용으로 할 일 하나를 만들고 같은 트랜잭션에서 메모를 지운다                                                           |
| 여러 할 일로 바꾸기 | `ConvertMemoToTodosUseCase`                           | 할 일을 차례로 만들고 모두 되면 메모를 지운다. 중간에 실패하면 앞 할 일과 메모가 남는다                                     |
| 계획 메모           | `PlanMemoWriterPort`, `PlanMemoReadModel`             | voice 계획 적용이 손으로 만든 메모와 같은 한도로 키 없이 만들고 지우는 메모                                                 |

| 상태       | 행동                               | 다음                      | 같은 값으로 다시                 |
| ---------- | ---------------------------------- | ------------------------- | -------------------------------- |
| 없음       | `Memo.create`                      | 고정 안 함, 마지막 순서+1 | 같은 Idempotency-Key면 처음 메모 |
| 고정 안 함 | `changePinned(true)`               | 고정                      | `false`(저장하지 않음)           |
| 고정       | `changePinned(false)`              | 고정 안 함                | `false`(저장하지 않음)           |
| 아무 내용  | `rewrite(content)`                 | 새 내용                   | 같은 내용이면 `false`            |
| 아무 순서  | `moveTo(sortOrder)`                | 새 순서                   | 같은 순서면 `false`              |
| 있음       | `DeleteMemoUseCase`·할 일로 바꾸기 | 없음                      | 없거나 남의 메모면 `MEMO_2001`   |

`true`인 행동만 `updatedAt`을 옮기고 저장한다. 순서 바꾸기로 밀린 메모도 `updatedAt`이 바뀐다.

## voice

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

## support

| 용어      | 코드                                  | 뜻                                                                                      |
| --------- | ------------------------------------- | --------------------------------------------------------------------------------------- |
| 문의      | `Inquiry`(Aggregate)                  | 사용자가 고객센터에 보내는 글. 저장하지 않고 담당자에게 전달하는 동안만 있다            |
| 문의 유형 | `InquiryCategory`                     | `BUG_REPORT`·`FEATURE_REQUEST`·`PAYMENT`·`OTHER`. 전달 문구에는 한국어 라벨을 붙인다    |
| 문의 내용 | `InquiryContent`(VO)                  | `INQUIRY_CONTENT_LIMITS` 길이 안의 원문. 담당자가 그대로 읽으므로 공백을 다듬지 않는다  |
| 접수      | `CreateInquiryUseCase`                | 문의를 만들고 바로 전달한다. 전달이 거절되면 `INQUIRY_1501`로 알려 사용자가 다시 보낸다 |
| 전달      | `InquiryMailerPort.deliver`           | 담당 채널(지금은 이메일)로 한 번 보낸다. 결과는 `sent`·`rejected` 값이다                |
| 제출 시각 | `submittedAt`, `formatSubmittedAtKst` | 접수한 시각. 담당자가 한국에서 읽으므로 KST로 적는다                                    |

문의는 상태가 없다(만들고 전달하면 끝난다).

## app-config

운영자가 env로 정하고 서버는 읽기만 한다. 두 Aggregate 모두 상태 전이가 없고 env → Aggregate 복원은 `*-env.mapper.ts`가 한다.

| 용어             | 코드                                                                | 뜻                                                                                               |
| ---------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 앱 릴리스        | `AppRelease`(Aggregate), `AppReleaseId`                             | 스토어에 공개된 플랫폼별 최신 앱. 플랫폼(`ios`·`android`)이 식별자다                             |
| 앱 버전          | `AppVersion`(VO, `app-config/shared/domain`)                        | 시작할 때 SemVer로 검증한 버전 문자열                                                            |
| 최신 릴리스 조회 | `ListAppReleasesUseCase`, `listLatestReleases`                      | 확인을 껐거나 한 플랫폼이라도 버전이 없으면 빈 목록이고 응답은 `enabled: false`다(안전하게 닫음) |
| 기능 소개 캠페인 | `FeatureDiscoveryCampaign`(Aggregate), `FeatureDiscoveryCampaignId` | 운영 kill switch로 켠 기능 소개. 식별자는 앱에 번들된 문구 key다                                 |
| 최소 앱 버전     | `minAppVersion`                                                     | 이 버전 이상 앱만 소개를 보인다(판단은 앱이 한다)                                                |
| 진행 중 캠페인   | `GetFeatureDiscoveryCampaignUseCase`, `findActiveCampaign`          | 꺼져 있거나 필수 설정이 빠졌거나 출시 시각을 읽을 수 없으면 `null`이다                           |

## operations

### broadcasts

| 용어             | 코드                                                             | 뜻                                                                                   |
| ---------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 브로드캐스트     | `BroadcastCampaign`(Aggregate)                                   | 관리자가 대상 필터로 보내는 알림 한 건과 그 분배 진행                                |
| 요청 ID          | `requestId`, `isSameRequest`                                     | 같은 접수를 알아보는 키. 같은 ID에 다른 내용이면 `ADMIN_1405`다                      |
| 대상 필터        | `BroadcastTargetFilter`                                          | 보낼 사용자 집합. 대상이 없으면 `ADMIN_1402`다                                       |
| 문구             | `BroadcastContent`·`BroadcastLocalizedContent`(VO), `contentFor` | 기본 제목·본문과 언어별 문구. 수신자 언어 문구가 없으면 기본 문구다                  |
| 발송 시점        | `BroadcastDelivery`(VO)                                          | `NOW`(접수 직후) 또는 `RECIPIENT_LOCAL_TIME`(수신자 시간대의 그 날짜·시각)           |
| 알림 동작        | `BroadcastAction`(VO)                                            | 알림을 눌렀을 때 앱이 할 일과 주소                                                   |
| 분배             | `FanOutBroadcastCampaignUseCase`, `recordPage`                   | 대상을 사용자 ID cursor 순서로 500명씩 나눠 알림·발송 작업을 만든다                  |
| 캠페인 키        | `campaignKey`                                                    | `admin-broadcast:<id>`. 알림·발송 행을 캠페인에 묶고 발송 결과 집계가 이 키로 찾는다 |
| 특정 사용자 발송 | `SendTargetedNotificationUseCase`                                | 캠페인 없이 지정한 사용자에게 한 번 보낸다                                           |

| 상태                   | 행동                                       | 다음                          | 같은 상태로 다시·금지                  |
| ---------------------- | ------------------------------------------ | ----------------------------- | -------------------------------------- |
| `QUEUED`               | `start`                                    | `FANNING_OUT`                 | —                                      |
| `FANNING_OUT`          | `start`                                    | —                             | `false`                                |
| `FANNING_OUT`          | `recordPage`                               | `FANNING_OUT`(cursor·수 증가) | 다른 상태는 `broadcastNotDistributing` |
| `QUEUED`·`FANNING_OUT` | `complete`                                 | `COMPLETED`                   | `COMPLETED`면 `false`                  |
| `QUEUED`·`FANNING_OUT` | `fail(reason)`                             | `FAILED`                      | `FAILED`면 `false`                     |
| `COMPLETED`·`FAILED`   | 다른 상태로 가는 `start`·`complete`·`fail` | —                             | `broadcastCampaignFinished`            |

### admin-notices

쓰기 상태가 없어 Aggregate가 없다. 알림은 `admin-notification.v1` 큐 잡에 실려 있다가 채널로 나간다.

| 용어             | 코드                                                   | 뜻                                                                                            |
| ---------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| 관리자 알림      | `AdminNotice`                                          | 운영자 채널로 보내는 알림. `message`(일반)·`user_registered`(가입)·`subscription_event`(결제) |
| 알림 채널        | `AdminNotificationChannel`                             | `admin`(가입·운영), `payment`(결제). 채널마다 Discord webhook이 다르다                        |
| 일반 알림        | `AdminNotification`, `AdminNotificationMessage`(VO)    | 제목·본문·심각도·칸으로 조립한 알림. 제목·본문은 비어 있을 수 없다                            |
| 사용자 블록      | `AdminNoticeUser`, `ResolveAdminNoticeUserUseCase`     | 가입·결제 알림이 같은 모양으로 싣는 사용자 칸. 조회가 실패하면 호출한 Context가 준 값이다     |
| 알림 요청        | `AdminEventNotifierPort`, `*AlertInput`                | 다른 Context가 기다리지 않고 맡기는 요청. 실패해도 호출한 업무를 되돌리지 않는다              |
| 구독 알림 이벤트 | `SubscriptionNoticeEvent`, `subscriptionNoticeEventOf` | 운영자가 구분할 결제 일. 환불 → 체험 단계 → 일회성 구매 → 구독 종류 순으로 정한다             |
| 가입 방식        | `SignupMethod`                                         | 처음 만든 인증 계정의 공급자(`ACCOUNT_PROVIDERS`)                                             |
| 일일 가입 요약   | `DispatchDailySignupSummaryUseCase`                    | KST 00:10에 전일(KST) 가입 수를 공급자별로 모아 `admin` 채널에 보낸다                         |
| 발송             | `SendAdminNotificationUseCase`                         | 미설정 채널은 건너뛰고, 일시 실패는 큐가 다시 시도하고, 거절은 운영 경보를 올린다             |

### metrics

조회 전용이라 Aggregate가 없다.

| 용어        | 코드                                                   | 뜻                                                                                       |
| ----------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| 성장 요약   | `GrowthSummary`(Read Model), `GetGrowthSummaryUseCase` | 가입 cohort 범위와 지금 기준의 활동·리텐션 지표                                          |
| 지표 정의   | `GROWTH_METRIC_DEFINITIONS`                            | DAU·WAU·MAU·stickiness·activation24h·d1·d7·d30의 운영 문서와 같은 문장                   |
| cohort 지표 | `GrowthCohortMetric`                                   | 대상 수·달성 수·비율(%, 소수 둘째 자리). 측정 전이거나 대상이 없으면 리텐션은 `null`이다 |

## insights

할 일을 얼마나 끝냈는지 날짜·주 단위로 보여 준다. 두 Aggregate 모두 상태 전이가 없다. 일일 완료 현황은 조회마다 planning 할 일로 다시 세고, 주간 성취는 다시 기록하면 할 일 수·달성 시각만 덮어쓴다. 하루 단위 연속 기록(`UserPreference.currentStreak`)은 identity가 소유한다.

| 용어     | 코드                                                | 뜻                                                                                                 |
| -------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 할 일 수 | `TodoCompletionCount`(VO, `insights/shared/domain`) | 한 기간의 할 일 수와 그중 끝낸 수. 0 이상 정수이고 끝낸 수는 전체를 넘지 않는다(아니면 `SYS_0002`) |
| 완료율   | `completionRate`, `TodoCompletionCount.rate`        | 끝낸 수 ÷ 할 일 수를 0~100으로 반올림한 값. 할 일이 없으면 0이다                                   |

### daily-completions

| 용어           | 코드                                                         | 뜻                                                                                                               |
| -------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| 일일 완료 현황 | `DailyCompletion`(Aggregate), `GetDailyCompletionsUseCase`   | 한 사용자의 하루 할 일 수·끝낸 수·카테고리 색. 할 일이 있는 날만 있고 저장하지 않는다                            |
| 조회 구간      | `DateRange`(VO)                                              | 양 끝을 포함한 달력 날짜. 앱이 보낸 날짜 그대로이고 시작이 끝보다 늦으면 `SYS_0002`다                            |
| 그날의 할 일   | `tallyDailyCompletions`, `TodoCompletionGroup`               | 시작일 ≤ 그날 ≤ 종료일(없으면 시작일)인 할 일. 여러 날 할 일은 구간 안의 모든 날에 센다                          |
| 완료한 날      | `isComplete()`                                               | 할 일이 하나 이상이고 모두 끝낸 날(달력의 물고기). planning의 "완료"는 할 일 하나의 상태다                       |
| 완료일 수      | `totalCompleteDays`, `countCompleteDays`                     | 구간 안 완료한 날의 수                                                                                           |
| 카테고리 색    | `categoryColors`                                             | 그날 할 일의 카테고리 색. 중복 없이 문자열 오름차순(앱 정렬과 같다)                                              |
| 친구 완료 현황 | `GetFriendDailyCompletionsUseCase`, `listPublicByDateRange`  | 맞팔 친구(`FriendshipReaderPort`)의 공개 할 일만 센 현황. 맞팔이 아니면 날짜를 보기 전에 `FOLLOW_0906`이다       |
| 캐시 세대      | `DailyCompletionCache`, `DailyCompletionCacheKey.generation` | 사용자별 본인·공개 현황 캐시의 namespace. planning 할 일·회차·카테고리 이벤트가 커밋되면 세대를 바꿔 모두 버린다 |

`DailyCompletion` 테이블은 이 slice와 관계없다. insights는 읽지도 쓰지도 않고(운영 0행) ai-assistance 제안 활동 Reader만 읽어, Context 경계 층이 그 읽기를 옮긴 뒤 두 릴리스에 걸쳐 지운다([영속성](persistence.md#마이그레이션)).

### weekly-achievements

| 용어      | 코드                                                                    | 뜻                                                                                                              |
| --------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 주간 성취 | `WeeklyAchievement`(Aggregate), `WeeklyAchievementId`                   | 지난 한 주(월~일)의 할 일 수·끝낸 수. 사용자·주마다 하나다                                                      |
| ISO 주    | `IsoWeek`(VO)                                                           | 월요일에 시작하는 연도·주 번호(1~53, 그 밖은 `SYS_0002`)                                                        |
| 기록      | `RecordWeeklyAchievementsUseCase`, `WeeklyAchievementWriterPort.record` | notification 주간 리마인더가 센 값(`WeeklyAchievementTally`)을 남긴다. 같은 사용자·주는 처음 id를 두고 덮어쓴다 |
| 달성 시각 | `achievedAt`                                                            | 그 주를 센 시각. 다시 기록하면 바뀐다                                                                           |
| 완벽한 주 | `isPerfect()`, `perfectWeeks`                                           | 할 일이 하나 이상이고 모두 끝낸 주                                                                              |
| 연속 주   | `computeWeeklyStreak`, `currentStreak`·`bestStreak`                     | 기록이 있는 주가 끊김 없이 이어진 수(마지막 주 → 다음 해 1주 포함). `currentStreak`는 가장 최근 기록부터 센다   |
| 연도 요약 | `summarizeWeeklyAchievements`, `averageRate`                            | 페이지와 상관없이 그해 기록 전부로 센 주 수·완벽한 주·연속 주·주별 완료율의 반올림 평균                         |
| 주차 라벨 | `weekLabel`, `localToday`, `AchievementOwnerTimezoneReaderPort`         | 응답 매퍼가 만드는 "3월 2주차". 사용자 저장 시간대의 오늘로 올해를 정하고 다른 해의 주는 연도를 붙인다          |
| 없는 주   | `weeklyAchievementNotFound`                                             | 요청한 사용자의 그 주 기록이 없으면 `ACHIEVEMENT_1801`이다                                                      |

다른 Context 절은 그 Context를 기준 모양으로 맞추는 층에서 채운다.
