# operations 용어집

운영(브로드캐스트·관리자 알림) 기능을 설계·리뷰할 때 읽는다. 쓰는 법은 [용어집](../glossary.md)이다. 관리자 성장 지표는 데이터를 가진 identity `users`의 조회다([identity 용어집](identity.md#users)).

| slice                 | Aggregate                     | 테이블              |
| --------------------- | ----------------------------- | ------------------- |
| `broadcast-campaigns` | `BroadcastCampaign`           | `BroadcastCampaign` |
| `admin-notices`       | `AdminNotice`(생성만, 저장 X) | —                   |

다른 Context의 표는 직접 읽지 않는다. 대상 사용자 페이지는 한 문장을 지키려고 identity `userAudience`(사용자 칸·탈퇴·상태·로그인 조건), notification `hasPushTokenCondition`, access `activeSubscriptionCondition` 조각을 붙이고, 사용자 블록·가입 수는 identity `UserSignupReaderPort`로 읽는다.

## broadcast-campaigns

| 용어             | 코드                                                             | 뜻                                                                                   |
| ---------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 브로드캐스트     | `BroadcastCampaign`(Aggregate)                                   | 관리자가 대상 필터로 보내는 알림 한 건과 그 분배 진행                                |
| 요청 ID          | `requestId`, `isSameRequest`                                     | 같은 접수를 알아보는 키. 같은 ID에 다른 내용이면 `ADMIN_1405`다                      |
| 대상 필터        | `BroadcastTargetFilter`, `AdminUserDirectoryReaderPort`          | 보낼 사용자 집합. 대상이 없으면 `ADMIN_1402`다                                       |
| 문구             | `BroadcastContent`·`BroadcastLocalizedContent`(VO), `contentFor` | 기본 제목·본문과 언어별 문구. 수신자 언어 문구가 없으면 기본 문구다                  |
| 발송 시점        | `BroadcastDelivery`(VO)                                          | `NOW`(접수 직후) 또는 `RECIPIENT_LOCAL_TIME`(수신자 시간대의 그 날짜·시각)           |
| 알림 동작        | `BroadcastAction`(VO)                                            | 알림을 눌렀을 때 앱이 할 일과 주소                                                   |
| 분배             | `FanOutBroadcastCampaignUseCase`, `recordPage`                   | 대상을 사용자 ID cursor 순서로 500명씩 나눠 알림·발송 작업을 만든다                  |
| 캠페인 키        | `campaignKey`                                                    | `admin-broadcast:<id>`. 알림·발송 행을 캠페인에 묶고 발송 결과 집계가 이 키로 찾는다 |
| 수신자           | `BroadcastRecipientReadModel`                                    | 수신자 언어와 시간대. notification 발송 판단과 같은 폴백이다                         |
| 알림 메시지      | `BroadcastMessageReadModel`                                      | notification `PublishNotificationUseCase`에 넘기는 사용자별 알림 한 건               |
| 특정 사용자 발송 | `SendTargetedNotificationUseCase`                                | 캠페인 없이 지정한 사용자에게 한 번 보낸다. 탈퇴 대기·없는 사용자만 뺀다             |

| 상태                   | 행동                                       | 다음                          | 같은 상태로 다시·금지                                                |
| ---------------------- | ------------------------------------------ | ----------------------------- | -------------------------------------------------------------------- |
| `QUEUED`               | `start`                                    | `FANNING_OUT`                 | —                                                                    |
| `FANNING_OUT`          | `start`                                    | —                             | `false`                                                              |
| `FANNING_OUT`          | `recordPage`                               | `FANNING_OUT`(cursor·수 증가) | 같은 마지막 사용자면 `false`, 다른 상태는 `broadcastNotDistributing` |
| `QUEUED`·`FANNING_OUT` | `complete`                                 | `COMPLETED`                   | `COMPLETED`면 `false`                                                |
| `QUEUED`·`FANNING_OUT` | `fail(reason)`                             | `FAILED`                      | `FAILED`면 `false`                                                   |
| `COMPLETED`·`FAILED`   | 다른 상태로 가는 `start`·`complete`·`fail` | —                             | `broadcastCampaignFinished`                                          |

## admin-notices

`AdminNotice`는 저장하지 않는 생성만 하는 Aggregate다. `create`가 일반 알림의 제목·본문을 검증하고, `toPrimitives()` 값이 `admin-notification.v1` 큐 잡의 `notice`에 실려 있다가 채널로 나간다.

| 용어             | 코드                                                                             | 뜻                                                                                                              |
| ---------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 관리자 알림      | `AdminNotice`(Aggregate), `AdminNoticePrimitives`                                | 운영자 채널로 보내는 알림. `message`(일반)·`user_registered`(가입)·`subscription_event`(결제)                   |
| 알림 채널        | `AdminNotificationChannel`, `AdminNotice.channel`                                | `admin`(가입·운영), `payment`(결제). 결제 알림만 `payment`다. 채널마다 Discord webhook이 다르다                 |
| 중복 방지 key    | `deduplicationKey`                                                               | 같은 알림을 한 번만 등록하는 작업 key. 일일 요약 `signup-summary_<날짜>`, 결제 `subscription-event_<이벤트 ID>` |
| 일반 알림        | `AdminNotification`, `AdminNotificationMessage`(VO)                              | 제목·본문·심각도·칸으로 조립한 알림. 제목·본문은 비어 있을 수 없다                                              |
| 사용자 블록      | `AdminNoticeUser`, `ResolveAdminNoticeUserUseCase`                               | 가입·결제 알림이 같은 모양으로 싣는 사용자 칸. 조회가 실패하면 호출한 Context가 준 값이다                       |
| 알림 요청        | `AdminEventNotifierPort`, `SubscriptionNoticeInput`, `UserRegisteredNoticeInput` | 다른 Context가 기다리지 않고 맡기는 요청. 실패해도 호출한 업무를 되돌리지 않는다                                |
| 구독 알림 이벤트 | `SubscriptionNoticeEvent`, `subscriptionNoticeEventOf`                           | 운영자가 구분할 결제 일. 환불 → 체험 단계 → 일회성 구매 → 구독 종류 순으로 정한다                               |
| 가입 방식        | `SignupMethod`                                                                   | 처음 만든 인증 계정의 공급자(`ACCOUNT_PROVIDERS`)                                                               |
| 일일 가입 요약   | `DispatchDailySignupSummaryUseCase`                                              | KST 00:10에 전일(KST) 가입 수를 공급자별로 모아 `admin` 채널에 보낸다                                           |
| 발송             | `SendAdminNotificationUseCase`, `AdminNotificationRetryableError`                | 미설정 채널은 건너뛰고, 일시 실패는 큐가 다시 시도하고, 거절은 운영 경보를 올린다                               |
