# notification 용어집

알림함·푸시 기기·푸시 발송·이메일·리마인더·리텐션 실험 기능을 설계·리뷰할 때 읽는다. 쓰는 법은 [용어집](../glossary.md)이다.

사용자에게 가는 알림을 기록하고 채널(푸시·이메일)로 내보낸다. 무엇을 언제 누구에게 보내는지는 [푸시 알림](../push-notifications.md), delivery·receipt·기기·큐 운영은 [푸시 발송](../push-delivery.md), 차선·방해 금지·지표는 [알림 발송 설계](../notifications.md)에 있고 여기서는 되풀이하지 않는다. 관리자 브로드캐스트는 [operations](operations.md)가 소유하고 이 Context의 알림 발행으로 보낸다.

| 용어        | 코드                                                                                           | 뜻                                                                                                                                                                     |
| ----------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 알림 종류   | `NotificationType`, `NOTIFICATION_TYPES`                                                       | 알림이 무엇 때문에 왔는지. 앱 계약 값에 서버 전용 `PREMIUM_TRIAL_ENDING`·`PREMIUM_RENEWAL_UPCOMING`을 더하고 앱에는 `SYSTEM_NOTICE`로 보낸다(`toWireNotificationType`) |
| 알림 목적   | `purpose`(`NOTIFICATION_PURPOSES`)                                                             | `TRANSACTIONAL`(사용자 행동의 결과, 기본)·`SCHEDULED_SERVICE`(설정·구독한 정기 알림)·`ENGAGEMENT`(재방문 유도). 발송 정책과 분석이 이 값으로 나뉜다                    |
| 광고성 알림 | `isMarketingNotification`                                                                      | 광고성 수신 동의가 필요한 종류. 야간에는 동의와 상관없이 보내지 않고 푸시 문구에 광고 표기를 붙인다                                                                    |
| 알림 발행   | `PublishNotificationUseCase`(`publish`·`publishWithDeduplication`·`publishBatch`)              | 모든 Context가 알림을 만드는 문. 알림과 푸시 발송을 한 트랜잭션에 쓰고, 할 일 알림에는 그 할 일의 주인·날짜를 더한다                                                   |
| 알림 재료   | `CreateNotificationData`                                                                       | 받는 사람·종류·제목·본문과 이동 재료(`friendId`·`todoId`·`nudgeId`·`cheerId`), 중복 방지 날짜(`notificationDate`)                                                      |
| 알림 동작   | `NotificationAction`(`DEEP_LINK`·`BROWSER`·`WEBVIEW`·`NONE`)                                   | 알림을 눌렀을 때 할 일. 기본은 앱 안 이동이고 갈 곳은 종류와 재료로 정한다(`resolveNotificationDestination`)                                                           |
| 문구 키     | `copyKey`·`copyFacts`                                                                          | 알림함을 요청 언어로 다시 그릴 카탈로그 키와 재료. 없으면 저장한 제목·본문을 그대로 보인다                                                                             |
| 캠페인 키   | `campaignKey`·`variantId`, `SCHEDULER_CAMPAIGN_KEY`, `TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY` | 문구 성과를 나눠 보는 키. 문구 묶음이나 대상이 바뀌면 그 키의 버전만 올리고 작업 key·중복 방지 key는 그대로 둔다                                                       |
| 수신자 언어 | `resolveRecipientLocale`                                                                       | 저장한 앱 언어 → 마지막 요청 언어 → ko. 지원하지 않는 언어는 en이다                                                                                                    |
| 야간        | `PUSH_QUIET_HOURS_WINDOW`, `isWithinQuietHours`                                                | 수신자 현지 21시~8시. 광고성은 보내지 않고 일반 알림은 야간 수신 설정을 따른다                                                                                         |
| 알림 작업   | `NotificationQueueAdapter`, `notification.v1`                                                  | 다른 Context가 상태를 바꾼 트랜잭션 안에서 넣는 소셜·결제·마일스톤 알림 작업. 같은 원인은 결정적 job key로 한 번만 저장된다                                            |
| 마일스톤    | `NOTIFICATION_MILESTONES`, `SendMilestoneNotificationUseCase`                                  | 첫 완료·완료 10·50·100개·3일 연속·첫 친구. 사용자마다 단계별 한 번이다                                                                                                 |
| 수신 거부   | `OptOutMarketingPushUseCase`                                                                   | 광고성 푸시의 거부 링크 토큰이 맞으면 광고성 동의를 끈다. 토큰이 틀려도 같은 결과 화면을 준다                                                                          |
| 동의 재확인 | `ReconfirmMarketingConsentsUseCase`                                                            | 광고성 동의(또는 마지막 재확인) 뒤 2년이 지난 사용자에게 거래 알림으로 한 번 알린다. 현지 야간이면 낮 실행이 보낸다                                                    |

다른 Context는 아래 공개 면으로만 들어온다. notification은 다른 Context 테이블을 읽지 않고 그쪽이 구현한 포트로 설정·동의·할 일을 읽는다.

| 공개 면                               | 코드                                                                                                                                      | 쓰는 쪽                                                      |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `notification-delivery.public`        | `PublishNotificationUseCase`, `CreateNotificationData`, 문구 생성 함수                                                                    | 알림을 만드는 모든 Context                                   |
| `notification-delivery.public`        | `SessionPushDeviceReleasePort`, `DeleteActorNotificationsUseCase`                                                                         | identity 세션 폐기·계정 정리                                 |
| `notification-delivery.public`        | `NotificationRecipientLocaleReaderPort`·`NotificationRecipientTimezoneReaderPort`·`PushQuietHoursReaderPort`·`ClientAppVersionReaderPort` | 수신자 언어·시간대·야간·앱 버전을 묻는 쪽(초대·결제·운영 등) |
| `notification-delivery.public`        | `PushCampaignOutcomeReaderPort`                                                                                                           | operations 캠페인 결과 집계                                  |
| `notification-delivery-jobs.public`   | `NotificationQueueAdapter`                                                                                                                | social·billing·planning·identity·operations                  |
| `notification-email.public`           | `SendTransactionalEmailUseCase`                                                                                                           | identity 코드 메일, support 문의, social 신고                |
| `notification-reminders.public`       | `TodoReminderSchedulerPort`, `NOTIFICATION_SCHEDULE`                                                                                      | planning 할 일 리마인더 예약                                 |
| `notification-reminders-jobs.public`  | `TimezoneReminderEnqueuerPort`                                                                                                            | identity 설정(시간대·알림 시각 변경)                         |
| `notification-reminders-cache.public` | `ReminderTimezoneCachePort`                                                                                                               | identity 설정                                                |
| `notification-retention.public`       | `RetentionEnrollmentPort`                                                                                                                 | identity 가입·첫 인증                                        |

## notifications

| 용어           | 코드                                                               | 뜻                                                                                                                                     |
| -------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| 알림           | `Notification`(Aggregate, `notifications` slice), `NotificationId` | 한 사용자의 알림함 항목 하나. 푸시가 막혀도 알림함 기록은 남는다                                                                       |
| 알림함         | `ListNotificationsUseCase`, `InboxNotification`(Read Model)        | 최신순 목록과 카테고리(`ALL`·`NOTICE`·`TODO`·`SOCIAL`)·안 읽음 필터. 앱 버전이 해석하지 못하는 종류는 뺀다(`visibleNotificationTypes`) |
| 안 읽은 수     | `GetUnreadNotificationCountUseCase`, `NotificationInboxScope`      | 배지 숫자. 앱 버전 범위마다 따로 캐시하고 읽음·발행이 바뀌면 비운다                                                                    |
| 읽음           | `markRead`, `MarkNotificationReadUseCase`                          | 받은 사람만 읽음으로 바꾼다                                                                                                            |
| 모두 읽기      | `MarkAllNotificationsReadUseCase`                                  | 이 앱 버전이 보는 종류만 읽음으로 바꾼다. 새 앱으로 올리면 못 보던 알림은 안 읽음으로 보인다                                           |
| 열기           | `MarkNotificationOpenedUseCase`, `openedAt`                        | 푸시를 눌러 앱을 연 기록. 처음 연 때만 남기고 읽음도 맞춘다                                                                            |
| 중복 알림      | `SendNotificationWithDedupUseCase`, `resolveDedupStrategy`         | 같은 사용자·종류·대상의 알림이 창 안에 있으면 만들지 않는다. 지금은 친구 요청·수락이 같은 친구 24시간이다                              |
| 보낸 사람 정리 | `DeleteActorNotificationsUseCase`                                  | 탈퇴한 사람이 보낸 알림을 받은 사람들의 알림함에서 지우고 커밋 뒤 그들의 안 읽은 수 캐시를 비운다                                      |

| 상태         | 행동                         | 다음           | 다시·금지                                                                  |
| ------------ | ---------------------------- | -------------- | -------------------------------------------------------------------------- |
| 없음         | 알림 발행(`publish`)         | 안 읽음        | 중복 창·같은 회차면 만들지 않고 `null`                                     |
| 안 읽음      | `markRead(requesterId, now)` | 읽음(`readAt`) | 없는 알림 `NOTIFICATION_1004`, 남의 알림 `NOTIFICATION_1005`               |
| 읽음         | `markRead`                   | —              | `false`(저장·캐시 정리를 건너뛴다). 남의 알림이면 먼저 `NOTIFICATION_1005` |
| 안 읽음·읽음 | 열기(`markAsOpened`)         | 연 기록 + 읽음 | 이미 열었거나 없거나 남의 알림이면 오류 없이 `false`(푸시 탭 재시도)       |
| 안 읽음      | 모두 읽기(`markAllAsRead`)   | 읽음           | 이 앱이 못 보는 종류는 그대로                                              |

## push-devices

| 용어        | 코드                                                                | 뜻                                                                                                                                |
| ----------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 기기        | `PushDevice`(Aggregate, `push-devices` slice), `PushDeviceId`       | 한 사용자의 앱 설치 하나. 한 시점에 주인은 한 명이고, 다른 사용자가 같은 기기로 보고하면 이전 기록을 지운다                       |
| 기기 보고   | `ReportPushDeviceUseCase`                                           | 앱이 권한·토큰·언어·시간대를 보고한다. 같은 토큰을 가진 다른 사용자·기기의 등록은 같은 트랜잭션에서 지운다(소유 이전)             |
| 플랫폼      | `PushDevicePlatform`(`IOS`·`ANDROID`), `platformFromDeviceId`       | deviceId 접두어 `ios_`·`android_`, 없으면 기기 헤더로 정한다. 둘 다 모르면 `NOTIFICATION_1006`                                    |
| 알림 권한   | `PushPermission`(VO), `PushPermissionStatus`                        | 앱이 OS에서 읽은 `GRANTED`·`PROVISIONAL`·`DENIED`·`NOT_DETERMINED`와 다시 물을 수 있는지. 앞의 둘만 발송한다(`allowsDelivery`)    |
| 토큰        | `PushToken`(엔티티)                                                 | 기기·로그인 세션에 묶인 발송 주소. 값은 유일하고 형식이 틀리면 `NOTIFICATION_1001`                                                |
| 토큰 변화   | `PushTokenChange`, `tokenChange`                                    | 보고 하나가 토큰을 바꾸는 방식. `REGISTER`(허용+토큰)·`KEEP`(허용인데 토큰 없음 = 발급 실패 한 번)·`RELEASE`(권한 없음)           |
| 해제        | `UnregisterPushDeviceUseCase`, `UnregisterPushDeviceByTokenUseCase` | 로그인한 기기의 로그아웃 해제와 세션이 끝난 기기의 공개 해제. 공개 해제는 deviceId·토큰이 둘 다 맞을 때만 지우고 결과는 같게 준다 |
| 세션 해제   | `ReleaseSessionPushDevicesUseCase`                                  | identity가 세션을 폐기하면 그 세션의 기기·토큰을 바로 지운다. 실패해도 세션 폐기는 막지 않는다                                    |
| 오래된 기기 | `PUSH_DEVICE_STALE_AFTER_DAYS`                                      | 오래 보고하지 않은 기기는 지운 앱으로 보고 건너뜀 사유 판정에서 뺀다([기기와 토큰](../push-delivery.md#기기와-토큰))              |

기기는 보고마다 통째로 덮어쓰고 상태 전이가 없다. 토큰만 상태가 있다.

| 상태(토큰)  | 행동                                                             | 다음                      | 다시·금지                                                  |
| ----------- | ---------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------- |
| 없음·비활성 | 기기 보고 `REGISTER`                                             | 활성                      | 동시 등록 충돌은 새 트랜잭션에서 한 번만 다시 한다         |
| 활성        | 기기 보고 `KEEP`                                                 | 활성(세션·앱 버전만 맞춤) | 토큰이 없던 기기면 그대로 없음                             |
| 활성·비활성 | 기기 보고 `RELEASE`, 해제, 세션 폐기, 소유 이전                  | 없음                      | 없는 등록을 해제해도 성공                                  |
| 활성        | `deactivateInvalidTokens`(`DEVICE_UNREGISTERED`·`INVALID_TOKEN`) | 비활성                    | receipt 실패는 발송 당시 토큰 지문과 지금 토큰이 같을 때만 |

## push-dispatches

| 용어          | 코드                                                                     | 뜻                                                                                                                               |
| ------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| 발송          | `PushDispatch`(Aggregate, `push-dispatches` slice)                       | 알림 하나를 한 사용자의 기기들로 보내는 일. 알림과 같은 트랜잭션에서 만들고(`stage`·`stageMany`) 커밋 뒤 큐가 보낸다             |
| 발송 아웃박스 | `PushDispatchOutbox`(엔티티)                                             | 발송을 `push-delivery.v1`에 올리는 행. 커밋 직후 빠른 경로와 매분 relay(`RelayPushDeliveryOutboxUseCase`)가 같은 행을 올린다     |
| 발행 세대     | `publishAttempt`, `PushDeliveryPublication`                              | 아웃박스를 다시 열 때마다 느는 번호. 큐 작업 key와 담당 표시가 이 값을 쓴다                                                      |
| 담당 표시     | `PushDeliveryFence`                                                      | 발송·세대·작업 id·시도 수. 늦게 끝난 worker가 새 세대의 결과를 덮지 못하게 한다. 외부 공급자까지 한 번 전달을 보장하지 않는다    |
| 발송 방식     | `PushDeliveryMode`(`SINGLE`·`BATCH`), `force`                            | 단건 발행과 묶음 발행. 강제 발송은 관리자 공지 묶음만 쓰고 수신 설정·야간만 넘는다                                               |
| 차선          | `PushDeliveryLane`(`TRANSACTIONAL`·`MARKETING`), `pushDeliveryLaneOf`    | 큐 우선순위. 광고성·참여 유도·관리자 브로드캐스트가 리마인더를 밀어내지 않게 나눈다                                              |
| 발송 자격     | `EvaluatePushDeliveryEligibilityUseCase`                                 | 수신 설정·광고성 동의·야간·빈도 한도·토큰·앱 버전을 한곳에서 판단한다([공통 발송 조건](../push-notifications.md#공통-발송-조건)) |
| 건너뜀 사유   | `PushDispatchSkipReason`, `noActiveTokenSkipReason`                      | 푸시를 보내지 않은 이유. 관리자 캠페인 집계가 이 값으로 센다                                                                     |
| 빈도 한도     | `PUSH_RATE_LIMIT_POLICY`, `PushRateLimiterPort`, `markRateLimitReserved` | 일반(시간당)과 참여 유도(하루·간격) 두 한도. 같은 발송의 재시도는 처음 예약을 다시 쓴다                                          |
| 보관 시간     | `pushDeliveryOptions`                                                    | 꺼진 기기에 공급자가 메시지를 들고 있는 시간(`ttl`). 종류마다 정한다                                                             |
| 전달 시도     | `PushDeliveryAttempt`(엔티티), `PushDeliveryAttemptStatus`               | 기기 토큰 하나에 대한 공급자 전송 결과와 ticket                                                                                  |
| 실패 종류     | `PushFailureKind`, `revokesPushToken`                                    | 공급자 오류를 채널 중립으로 바꾼 값. 기기 미등록·잘못된 토큰만 토큰을 끈다                                                       |
| receipt 확인  | `ReconcilePushReceiptsUseCase`, `PushReceiptTiming`                      | 수락한 ticket의 최종 결과를 공급자에게 묻는다. 대기·보관 시간은 채널이 준다                                                      |
| 푸시 채널     | `PushChannel`(어휘 값 `EXPO`), `PushChannelPort`                         | 공급자를 바꾸는 자리. 채널마다 포트 구현 하나이고 공급자 이름은 어댑터에만 둔다. FCM·Web Push는 값과 구현을 더한다               |

| 상태                      | 행동                                  | 다음                                           | 다시·금지                                                           |
| ------------------------- | ------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------- |
| 없음                      | `stage`(알림과 같은 트랜잭션)         | `PENDING`, 아웃박스 `PENDING`                  | —                                                                   |
| 아웃박스 `PENDING`        | `claimAvailable`·`claimByDispatchIds` | 아웃박스 `PROCESSING`                          | —                                                                   |
| 아웃박스 `PROCESSING`     | 큐 등록 뒤 `markPublished`            | 아웃박스 `PUBLISHED`                           | 등록 실패는 `defer`로 `PENDING`(지수 대기). 같은 세대 재등록은 성공 |
| `PENDING`                 | `claim`(`push-delivery.v1` 작업)      | `PROCESSING`(담당 표시)                        | 끝난 발송·다른 세대는 집지 않는다                                   |
| `PROCESSING`              | `finalizeSkipped(reason)`             | `SKIPPED`                                      | 담당 표시가 다르면 0건(늦은 worker)                                 |
| `PROCESSING`              | `finalizeResults(results)`            | 한 토큰이라도 수락이면 `SENT`, 아니면 `FAILED` | 담당 표시가 다르면 0건                                              |
| `PROCESSING`              | `release`(작업 실패)                  | `PENDING`                                      | 마지막 시도면 아웃박스를 새 세대로 연다                             |
| `PROCESSING`(lease 지남)  | `recoverStaleProcessing`              | `PENDING`, 아웃박스 `PENDING`                  | —                                                                   |
| `SENT`·`SKIPPED`·`FAILED` | —                                     | —                                              | 끝. DLQ 복구(`reopenFailedPublications`)도 건너뛴다                 |

| 상태(전달 시도)   | 행동                                | 다음                                             | 다시·금지                                 |
| ----------------- | ----------------------------------- | ------------------------------------------------ | ----------------------------------------- |
| 없음              | `finalizeResults`                   | 수락 `TICKET_ACCEPTED`, 거절 `FAILED`(실패 종류) | —                                         |
| `TICKET_ACCEPTED` | `recordPushReceipts`                | `DELIVERED` 또는 `FAILED`                        | 끝난 ticket의 중복 응답은 되돌리지 않는다 |
| `TICKET_ACCEPTED` | `expireUnreceipted`(보관 기간 지남) | `UNKNOWN`(`RECEIPT_EXPIRED`)                     | —                                         |

발송의 `HOLDOUT`과 전달 시도의 `PENDING`은 DB 값만 있고 어떤 행동도 그 상태로 보내지 않는다.

## email-messages

| 용어        | 코드                                                           | 뜻                                                                                                                                     |
| ----------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 이메일      | `EmailMessage`(Aggregate, `email-messages` slice)              | 렌더한 메일 한 통(받는 사람·제목·HTML·텍스트·태그). 만들기만 하고 저장하지 않으며 큐에 실어 보낸다. 받는 사람·제목이 비면 `SYS_0002`   |
| 메일 종류   | `EmailKind`(`EMAIL_KINDS`)                                     | `verification`·`password-reset`·`password-setup`(사용자가 기다리는 코드), `inquiry`·`user-report`(운영자에게 가는 문의·신고)           |
| 중요도      | `EmailPriority`(`critical`·`standard`), `resolveEmailPriority` | 코드 메일은 `critical`, 문의·신고는 `standard`. `standard`는 한도보다 먼저 멈춰 `critical` 몫을 남긴다                                 |
| 발송 예산   | `EmailBudgetPort`, `EmailSendBudget`                           | 공급자 무료 한도를 넘지 않게 세는 일·월 건수. 담을 때 예약하고 못 보낸 채 끝나면 돌려준다. 계량이 실패하면 예약된 것으로 본다          |
| 발송 요청   | `SendTransactionalEmailUseCase`, `EmailDispatch`               | 받는 사람 언어로 템플릿을 렌더해 `email-delivery.v1`에 담는다. 결과는 `queued` 또는 `rejected`(`budget_exhausted`·`queue_unavailable`) |
| 문의 메일   | `sendInquiry`, `EmailSendResult`                               | 문의는 DB에 남지 않아 큐 없이 요청 안에서 한 번 보내고, 실패를 돌려줘 사용자가 다시 보내게 한다                                        |
| 전달        | `DeliverEmailUseCase`, `deliveryId`                            | 큐에서 꺼낸 한 통을 공급자로 보낸다. `deliveryId`가 공급자 멱등 키이고 재시도는 큐가 한다                                              |
| 메일 공급자 | `EmailSenderPort`, `EmailTemplateRendererPort`                 | 공급자를 바꾸는 자리. 한 번 시도하고 결과를 값으로 돌려주며 던지지 않는다                                                              |
| 메일 템플릿 | `EmailTemplateMail`, `<이름>.email.tsx`                        | React Email로 만든 제목·HTML·텍스트. `@nestjs/mail` 메일 클래스로 렌더하고 문구는 `email.json`이다                                     |

이메일은 저장하지 않아 상태 전이가 없다. 같은 `deliveryId`는 큐에 한 번만 담기고(`duplicate`면 예약을 돌려준다) 공급자에도 같은 멱등 키로 나간다.

## reminders

| 용어             | 코드                                                     | 뜻                                                                                                                                                                                                                 |
| ---------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 리마인더         | `Reminder`(Aggregate, `reminders` slice)                 | 종류·사용자·현지 날짜 하나에 한 번 가는 시각 기반 알림. 할 일 리마인더는 할 일·단계·회차가 한 번의 단위다                                                                                                          |
| 리마인더 종류    | 알림 종류 값                                             | 할 일·아침·저녁·날씨 아침·저녁, 점심 독려·스트릭 위기·소셜 요약, 친구 콕 제안·재방문, 주간 성취·주간·월간 리포트, 온보딩(`SYSTEM_NOTICE`). 시각은 [자동 발송 일정](../push-notifications.md#자동-발송-일정과-대상) |
| 매분 sweep       | `SweepTimezoneRemindersUseCase`, `TimezoneContext`       | 현지 날짜·시·분이 같은 시간대를 묶어 그 시각의 종류를 실행한다. 놓친 분은 늦음 한도만큼만 따라잡는다                                                                                                               |
| 발송 창          | `NOTIFICATION_SCHEDULE`, `isWithinScheduleWindow`        | 고정 시각 종류의 현지 시각과 늦게 돈 sweep을 받아 주는 몇 분                                                                                                                                                       |
| 할 일 단계       | `REMINDER_STAGES`(`60min`·`10min`), `planReminderJobs`   | 할 일 시각 전 두 단계. 예약할 때 이미 지난 단계는 건너뛴다                                                                                                                                                         |
| 회차             | `createReminderOccurrenceKey`                            | 날짜 + 벽시계. 시간대가 바뀌어도 같고 사용자가 날짜·시각을 고치면 달라진다                                                                                                                                         |
| 늦음             | `reminderLateSkipReason`(`late-over-15m`·`todo-started`) | 울려야 했던 시각에서 한도를 넘었거나 할 일이 이미 시작됐으면 보내지 않고 사유를 남긴다                                                                                                                             |
| 재방문 단계      | `resolveWinbackStage`(`day3`~`day30`)                    | 미접속 일수로 정하는 단계. 사용자마다 단계별 한 번                                                                                                                                                                 |
| 온보딩 날        | `isOnboardingDay`, `resolveOnboardingDeepLinkPath`       | 가입 뒤 정해진 날. 날마다 문구가 권하는 화면을 연다                                                                                                                                                                |
| 반복 멈춤 안내   | `TodoSeriesOwnerDormancyPort`                            | 휴면 소유자의 반복 회차는 리마인더 대신 같은 시각에 한 번 안내한다                                                                                                                                                 |
| 중복 방지 저장소 | `NotificationDedupPort`, `SchedulerDedupPort`            | 보낸 리마인더를 기억하는 곳. 날짜 기록·알림 이력(하루 종류), 할 일·단계·회차 유니크 인덱스, 재방문 단계·주간 콕 제안 짝                                                                                            |

| 상태    | 행동         | 다음            | 다시·금지                                 |
| ------- | ------------ | --------------- | ----------------------------------------- |
| 안 보냄 | `markSent()` | 보냄(알림 발행) | —                                         |
| 보냄    | `markSent()` | —               | `false`(발행을 건너뛴다)                  |
| 안 보냄 | 늦음 판정    | —               | 보냄으로 바꾸지 않고 사유만 로그에 남긴다 |

## retention-assignments

| 용어             | 코드                                                                                                | 뜻                                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 리텐션 배정      | `RetentionAssignment`(Aggregate, `retention-assignments` slice)                                     | 신규 사용자 한 명의 리텐션 실험 참여. 실험 키(`RETENTION_EXPERIMENT_KEY`)·실험군·시작 시각을 갖는다            |
| 실험군           | `RetentionVariant`(`CONTROL`·`TREATMENT`), `ExperimentAssignerPort`                                 | 같은 실험·사용자는 실행·재시도와 상관없이 늘 같은 실험군이다. 처리군이 앞 구간을 차지하는 순서를 바꾸지 않는다 |
| 등록·시작        | `RetentionEnrollmentPort`, `EnrollRetentionExperimentUseCase`, `ActivateRetentionExperimentUseCase` | identity가 가입 때 등록하고 첫 인증 때 시작한다. 시작하면 네 단계를 만든다. 설정으로 끄면 아무것도 하지 않는다 |
| 단계             | `RetentionStage`(엔티티), `RetentionStageName`(`D0`·`D1`·`D3`·`D7`)                                 | 시작 뒤 정해진 현지 날짜·시각에 한 번 결정하는 알림 자리                                                       |
| 단계 결정        | `decideRetentionStage`, `RetentionStageDecision`                                                    | `WAIT`·`SKIP`(사유)·`SEND`(이동 경로·문구 변형)·`EVALUATE_ONLY`(측정만)                                        |
| 단계 처리        | `ProcessRetentionStagesUseCase`                                                                     | 매분 결정할 때가 된 `SCHEDULED` 단계를 생성 순서로 처리한다. 대조군은 보내지 않고 D7에서 측정만 한다           |
| 리텐션 발송 조건 | `retentionPushSkipReason`                                                                           | 푸시 켜짐·광고성 동의·활성 토큰·현지 낮. 통과하면 `ENGAGEMENT` 목적으로 알림을 발행한다                        |
| D7 결과          | `RetentionExperimentResult`, `recordD7Result`                                                       | D7 단계에서 재방문·할 일 행동 여부를 실험군과 상관없이 기록한다                                                |

| 상태(배정) | 행동                  | 다음                                            | 다시·금지                   |
| ---------- | --------------------- | ----------------------------------------------- | --------------------------- |
| 없음       | `enroll`              | 시작 전. 가입 때 이미 인증했으면 시작 + 네 단계 | 이미 등록이면 바꾸지 않는다 |
| 시작 전    | `activate(startedAt)` | 시작, 네 단계 `SCHEDULED`                       | 이미 시작이면 `false`       |

| 상태(단계)  | 행동                       | 다음                                             | 다시·금지                                   |
| ----------- | -------------------------- | ------------------------------------------------ | ------------------------------------------- |
| `SCHEDULED` | 결정이 `WAIT`              | `SCHEDULED`                                      | —                                           |
| `SCHEDULED` | `markStageSkipped(reason)` | `SKIPPED`                                        | 이미 처리했으면 `false`                     |
| `SCHEDULED` | `markStageOutboxed`        | `OUTBOXED`, 알림 발행 뒤 `linkStageNotification` | 다른 실행이 먼저면 `false`(발행하지 않는다) |

`EVALUATED`는 DB 값만 있다. 측정만 하는 결정(`EVALUATE_ONLY`)과 대조군의 단계도 `SKIPPED`로 닫는다.
