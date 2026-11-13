# 도메인 용어집

기능을 설계·리뷰하거나 다른 부서와 같은 말로 이야기할 때 읽는다. Bounded Context마다 업무 용어와 코드 이름, 상태 전이를 한 표로 둔다. 코드 이름은 이 표의 말을 따르고([도메인 모델](domain-modeling.md#상태와-행동-이름)), 표에 없는 새 용어는 그 기능을 더하는 PR이 함께 적는다.

## 쓰는 법

- 용어는 사용자·운영자가 실제로 쓰는 한국어다. 코드 이름은 그 용어의 영어 한 단어(또는 두 단어)이고, Context 안에서 한 용어에 한 이름만 쓴다.
- 같은 낱말이 Context마다 다른 뜻이면 각 Context 절에 따로 적는다(예: planning의 "완료"와 insights의 "완료한 날").
- 상태가 있는 Aggregate는 전이 표를 둔다. 행동은 Aggregate 메서드 이름, 결과는 `true`(바뀜)·`false`(이미 그 상태)·오류다.

## notes (기준 구현)

| 용어           | 코드                       | 뜻                                                           |
| -------------- | -------------------------- | ------------------------------------------------------------ |
| 메모           | `Memo`(Aggregate)          | 사용자가 할 일로 바꾸기 전에 적어 두는 글                    |
| 메모 내용      | `MemoContent`(VO)          | 1자 이상 `MEMO_LIMITS.MAX_CONTENT_LENGTH`자 이하의 글        |
| 고정           | `isPinned`, `changePinned` | 목록 맨 위에 두는 표시                                       |
| 순서           | `sortOrder`, `moveTo`      | 고정 안에서·밖에서 사용자가 정한 위치                        |
| 다시 쓰기      | `rewrite`                  | 메모 내용을 바꾸는 행동                                      |
| 할 일로 바꾸기 | `ConvertMemoToTodoUseCase` | 메모 내용으로 할 일을 만들고 같은 트랜잭션에서 메모를 지운다 |

| 상태       | 행동                  | 다음       | 같은 값으로 다시       |
| ---------- | --------------------- | ---------- | ---------------------- |
| 고정 안 함 | `changePinned(true)`  | 고정       | —                      |
| 고정       | `changePinned(false)` | 고정 안 함 | `false`(저장하지 않음) |
| 아무 순서  | `moveTo(sortOrder)`   | 새 순서    | 같은 순서면 `false`    |

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

다른 Context 절은 그 Context를 기준 모양으로 맞추는 층에서 채운다.
