# operations 용어집

운영(브로드캐스트·관리자 알림·지표) 기능을 설계·리뷰할 때 읽는다. 쓰는 법은 [용어집](../glossary.md)이다.

## broadcasts

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

## admin-notices

쓰기 상태가 없어 Aggregate가 없다. 알림은 `admin-notification.v1` 큐 잡에 실려 있다가 채널로 나간다.

| 용어             | 코드                                                                            | 뜻                                                                                            |
| ---------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 관리자 알림      | `AdminNotice`                                                                   | 운영자 채널로 보내는 알림. `message`(일반)·`user_registered`(가입)·`subscription_event`(결제) |
| 알림 채널        | `AdminNotificationChannel`                                                      | `admin`(가입·운영), `payment`(결제). 채널마다 Discord webhook이 다르다                        |
| 일반 알림        | `AdminNotification`, `AdminNotificationMessage`(VO)                             | 제목·본문·심각도·칸으로 조립한 알림. 제목·본문은 비어 있을 수 없다                            |
| 사용자 블록      | `AdminNoticeUser`, `ResolveAdminNoticeUserUseCase`                              | 가입·결제 알림이 같은 모양으로 싣는 사용자 칸. 조회가 실패하면 호출한 Context가 준 값이다     |
| 알림 요청        | `AdminEventNotifierPort`, `SubscriptionNoticeInput`, `UserRegisteredAlertInput` | 다른 Context가 기다리지 않고 맡기는 요청. 실패해도 호출한 업무를 되돌리지 않는다              |
| 구독 알림 이벤트 | `SubscriptionNoticeEvent`, `subscriptionNoticeEventOf`                          | 운영자가 구분할 결제 일. 환불 → 체험 단계 → 일회성 구매 → 구독 종류 순으로 정한다             |
| 가입 방식        | `SignupMethod`                                                                  | 처음 만든 인증 계정의 공급자(`ACCOUNT_PROVIDERS`)                                             |
| 일일 가입 요약   | `DispatchDailySignupSummaryUseCase`                                             | KST 00:10에 전일(KST) 가입 수를 공급자별로 모아 `admin` 채널에 보낸다                         |
| 발송             | `SendAdminNotificationUseCase`                                                  | 미설정 채널은 건너뛰고, 일시 실패는 큐가 다시 시도하고, 거절은 운영 경보를 올린다             |

## metrics

조회 전용이라 Aggregate가 없다.

| 용어        | 코드                                                   | 뜻                                                                                       |
| ----------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| 성장 요약   | `GrowthSummary`(Read Model), `GetGrowthSummaryUseCase` | 가입 cohort 범위와 지금 기준의 활동·리텐션 지표                                          |
| 지표 정의   | `GROWTH_METRIC_DEFINITIONS`                            | DAU·WAU·MAU·stickiness·activation24h·d1·d7·d30의 운영 문서와 같은 문장                   |
| cohort 지표 | `GrowthCohortMetric`                                   | 대상 수·달성 수·비율(%, 소수 둘째 자리). 측정 전이거나 대상이 없으면 리텐션은 `null`이다 |
