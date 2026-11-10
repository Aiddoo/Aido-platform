# 푸시 알림 운영 기준

발송 정책·동의·일정 또는 delivery/receipt 장애를 확인할 때 참고한다. 구현 정본은 `src/modules/notification`과 `src/platform/jobs`다. 시각은 별도 표기가 없으면 모두 **사용자 IANA 타임존의 로컬 시각**이다.

## 공통 발송 조건

서버 발송에는 활성 Expo 토큰과 `pushEnabled=true`가 필요하다. OS 알림 권한과 실제 기기 도착은 서버 ticket/receipt만으로 보장하지 못한다. 알림 레코드 생성과 실제 푸시 전송은 분리되어 있으므로, 푸시가 차단돼도 앱 안 알림함 기록은 남을 수 있다.

| 정책             | 기준                                                                                                                                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 일반 빈도 제한   | 사용자당 최근 1시간 최대 15회                                                                                                                                                                      |
| 참여 유도 제한   | 로컬 날짜 기준 하루 최대 2회, 발송 사이 최소 4시간                                                                                                                                                 |
| 참여 유도 대상   | `purpose=ENGAGEMENT` 또는 `WINBACK`, `SOCIAL_DIGEST`, `NUDGE_SUGGEST`, `LUNCH_NUDGE`, `STREAK_AT_RISK`, `AI_SUGGESTION`, `INVITE_QUALIFY_REMINDER`                                                 |
| 광고성 푸시 동의 | 참여 유도 대상은 `marketingPushAgreedAt`이 있어야 함                                                                                                                                               |
| 광고성 푸시 표기 | 참여 유도 대상의 푸시는 제목 앞 "(광고) "(en "(Ad) ")와 본문 끝 줄 "수신 거부: 설정 > 알림"을 붙인다. 알림함 기록은 원래 문구다(`marketing-push-label.ts`, `PushNotificationPayloadFactory` 한 곳) |
| 야간 시간        | 21:00 이상 08:00 미만                                                                                                                                                                              |
| 야간 참여 유도   | 동의 여부와 관계없이 발송하지 않음                                                                                                                                                                 |
| 야간 일반 푸시   | `nightPushEnabled=true`일 때 발송                                                                                                                                                                  |
| 야간 예외        | 사용자가 시각을 정한 `WEATHER_MORNING`, `WEATHER_EVENING`                                                                                                                                          |
| Redis 장애       | 기존 정책대로 fail-open. 비정상 배치 결과도 타입 검증 후 전체 허용                                                                                                                                 |

기본 제한 저장소는 PostgreSQL이다. Redis backend를 선택한 경우 배치는 하나의 Lua 실행으로 입력 순서대로 예약하며 기존 fail-open 의미를 유지한다. 동일 dispatch retry는 reservation을 재사용하고, 저장소 선택과 새 delivery attempt를 혼동하지 않는다.

## 자동 발송 일정과 대상

| 시각/트리거                  | 알림                       |      무료 | 프리미엄·관리자 | 주요 조건                                                                                                                                                                                       |
| ---------------------------- | -------------------------- | --------: | --------------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 할 일 시각 -60분/-10분       | `TODO_REMINDER`            |         O |               O | 활성·미완료 할 일, 회차(날짜 + 벽시계)와 단계마다 한 번([규칙](todo-floating-time.md#알림-중복-방지)). 지난 단계는 건너뜀. 반복 회차는 소유자가 휴면이면 발송 시점에 건너뜀                     |
| 기본 07:00, 사용자 설정 가능 | `WEATHER_MORNING`          |         O |               O | 날씨 알림 사용. v2 리포트 + 오늘 할 일(아래 날씨 알림). 위치가 없으면 위치 설정 안내                                                                                                            |
| 08:00                        | `MORNING_REMINDER`         |         O |               - | 오늘 할 일이 없어도 하루 1회                                                                                                                                                                    |
| 사용자 설정 오전 시각        | `MORNING_REMINDER`         |         - |               O | 시간·분 커스텀, 하루 1회                                                                                                                                                                        |
| 가입일 +2시간                | Retention V2 D0            | 실험 대상 |       실험 대상 | treatment 사용자, 야간이면 다음 허용 시각으로 이월                                                                                                                                              |
| 10:30                        | 온보딩 / Retention V2      |         O |               O | legacy D0·D1·D2·D3·D5·D7 또는 treatment D1·D3·D7. 1.15.0부터 legacy 온보딩(사용법 안내)은 `SCHEDULED_SERVICE`라 광고성 동의 없이 받는다. Retention V2는 `ENGAGEMENT` 그대로다                   |
| 매월 1일 11:00 KST           | 광고성 동의 재확인         |         O |               O | 광고성 수신 동의(이메일·앱 푸시 중 이른 쪽) 또는 마지막 재확인이 2년 지난 활성 사용자에게 `SYSTEM_NOTICE`(거래) 1회(아래)                                                                       |
| 월요일 11:30                 | `WEEKLY_ACHIEVEMENT`       |         O |               - | 지난주 완료 1개 이상. 성취 기록은 모든 사용자에게 저장                                                                                                                                          |
| 월요일 11:30                 | `WEEKLY_REPORT`            |         - |               O | 지난주 활동이 있을 때                                                                                                                                                                           |
| 매월 1일 11:30               | `MONTHLY_REPORT`           |         - |               O | 지난달 활동이 있을 때. 같은 날 주간 리포트를 대체                                                                                                                                               |
| 12:30                        | `LUNCH_NUDGE`              |         O |               O | 오늘 할 일은 있으나 완료가 0개                                                                                                                                                                  |
| 15:00                        | `NUDGE_SUGGEST`            |         O |               O | 2~7일 비활성 맞팔 친구, 동일 조합 주 1회                                                                                                                                                        |
| 16:00                        | `WINBACK`                  |         O |               O | 3·7·14·21·30일 비활성 단계별 1회                                                                                                                                                                |
| 기본 17:30, 사용자 설정 가능 | `WEATHER_EVENING`          |         O |               O | 내일 비·눈 시작과 쌀쌀함(v2 리포트). 위치가 없으면 위치 설정 안내                                                                                                                               |
| 19:00                        | `EVENING_REMINDER`         |         O |               - | 오늘 할 일이 있는 사용자, 하루 1회                                                                                                                                                              |
| 사용자 설정 오후 시각        | `EVENING_REMINDER`         |         - |               O | 시간·분 커스텀, 하루 1회                                                                                                                                                                        |
| 20:15                        | `STREAK_AT_RISK`           |         O |               O | 유효 스트릭 3일 이상이며 오늘 미완료                                                                                                                                                            |
| 10분 주기(UTC)               | `PREMIUM_GRANT_ENDING`     |         O |               O | 스토어 구독 없이 보상 기간만으로 프리미엄인 마지막 기간이 24시간 안에 끝날 때 기간마다 1회. 야간이면 다음 허용 시각 실행으로 미룬다                                                             |
| 10분 주기(UTC)               | `PREMIUM_TRIAL_ENDING`     |         - |               O | 스토어 무료 체험(`periodType=TRIAL`)이 3일 안에 끝날 때 체인마다 1회. 시작할 때 이미 3일 이하였으면 보내지 않는다. 야간이면 다음 허용 시각 실행으로 미룬다(아래)                                |
| 10분 주기(UTC)               | `PREMIUM_RENEWAL_UPCOMING` |         - |               O | 연간으로 자동 갱신될(`nextProductId ?? productId`가 연간) ACTIVE·NORMAL 구독이 7일 안에 결제될 때 기간마다 1회. 월간·모르는 상품은 보내지 않는다. 야간이면 다음 허용 시각 실행으로 미룬다(아래) |
| 저녁 리마인더 +90분          | `SOCIAL_DIGEST`            |         O |               O | 직전 저녁 리마인더 알림 생성 대상 중 본인 미완료 + 완료 친구 존재. 같은 날 스트릭 위기 수신자는 제외                                                                                            |
| 18:00 (초대받은 사람 시간대) | `INVITE_QUALIFY_REMINDER`  |         O |               O | 초대 정비 작업(03:30 KST)이 예약. JOINED·할 일을 끝낸 날 1일·마감 3일 안·초대한 사람 보상 있음일 때 수락마다 1회(아래)                                                                          |

월간 리포트와 주간 리포트는 같은 11:30 슬롯에서 동시에 보내지 않는다. 무료 주간 달성 요약은 프리미엄 리포트와 대상이 다르므로 별도로 집계한다. 일일 스케줄은 `notificationDate`나 pg-boss `singletonKey`로 중복 생성·예약을 제한한다.

AI 제안 분석은 매시 정각 dispatch가 사용자 현지 07시대(따라잡기 10시 전까지)인 사용자만 등록하고, 같은 사용자의 같은 현지 날짜는 한 번만 분석한다(`suggestion_<userId>_<현지 날짜>` 키). 배포로 빠진 실행은 한 번만 보정한다(`missed: "once"`). 대상은 활성·미삭제 프리미엄과 관리자(`premiumAccessCondition`)이며 최근 14일에 반복이 아닌 할 일 기록이 있어야 한다. 분석 시작과 저장 transaction에서 `canInTx(userId, "AI_SUGGESTION")`으로 권한을 다시 확인하고, 실제 저장한 제안이 있을 때만 `AI_SUGGESTION`을 발행한다. 제안은 기록 기반 반복 설정·시작 단계 재시도·보완 제안을 포함한다. AI 할 일 만들기의 월간 횟수와 제안·리포트의 premium 권한 검사는 별도 정책이다.

이 권한 검사는 푸시 동의를 대신하지 않는다. AI 제안은 `purpose=ENGAGEMENT`이므로 마케팅 동의·참여 유도 한도·야간 억제와 공통 발송 조건을 추가로 적용한다. 주간·월간 AI 리포트는 premium 권한 대상의 서비스 알림이며 위 일정의 활동 조건을 따른다.

## 알림 타입별 계약

`목적`이 `참여`인 항목만 광고성 푸시 동의와 참여 유도 일일 한도를 적용한다. `서비스`와 `거래`는 일반 시간당 한도와 야간 설정을 적용한다.

| 타입                       | 발생 조건/생성 주체                                                                      | 목적         | 기본 이동                              |
| -------------------------- | ---------------------------------------------------------------------------------------- | ------------ | -------------------------------------- |
| `FOLLOW_NEW`               | 친구 신청 수신                                                                           | 거래         | 친구 신청 목록                         |
| `FOLLOW_ACCEPTED`          | 친구 성립. 수락이나 초대 입력을 한 사람이 아닌 상대에게만 보낸다                         | 거래         | 친구 피드, ID가 없으면 친구 목록       |
| `NUDGE_RECEIVED`           | 친구의 콕 또는 할 일 생성 리마인드 콕                                                    | 거래         | 친구 피드                              |
| `NUDGE_REPLIED`            | 보낸 콕에 친구가 답함 (1.11.0+)                                                          | 거래         | `navigation.kind=NUDGE`                |
| `NUDGE_THANKED`            | 콕을 받은 친구가 할 일을 끝내고 고마워함 (1.11.0+)                                       | 거래         | `navigation.kind=NUDGE`                |
| `CHEER_RECEIVED`           | 친구 응원 수신                                                                           | 거래         | 친구 피드                              |
| `DAILY_COMPLETE`           | 오늘 할 일 전체 완료                                                                     | 거래         | 피드                                   |
| `FRIEND_COMPLETED`         | 친구의 오늘 할 일 전체 완료                                                              | 거래         | 친구 피드                              |
| `TODO_REMINDER`            | -60분/-10분 지연 잡                                                                      | 서비스       | 피드 (`todoId` 유지)                   |
| `TODO_SHARED`              | 할 일 공유                                                                               | 거래         | 피드 (`todoId` 유지)                   |
| `MORNING_REMINDER`         | 아침 자동 스케줄                                                                         | 서비스       | 피드                                   |
| `EVENING_REMINDER`         | 저녁 자동 스케줄                                                                         | 서비스       | 피드                                   |
| `WEEKLY_ACHIEVEMENT`       | 무료 사용자 주간 성취                                                                    | 서비스       | 성취 화면                              |
| `WEEKLY_REPORT`            | 프리미엄·관리자 주간 리포트                                                              | 서비스       | 리포트 화면                            |
| `MONTHLY_REPORT`           | 프리미엄·관리자 월간 리포트                                                              | 서비스       | 리포트 화면                            |
| `AI_SUGGESTION`            | 기록 기반 할 일 제안                                                                     | 참여         | 제안 화면                              |
| `SYSTEM_NOTICE`            | 온보딩, 결제, 리텐션, 운영 공지                                                          | 생성 시 지정 | `DEEP_LINK` url 앱 경로(아래 표)       |
| `ADMIN_BROADCAST`          | 관리자 전체·조건 발송                                                                    | 생성 시 지정 | 명시적 action, 없으면 이동 안 함       |
| `ADMIN_TARGETED`           | 관리자 특정 사용자 발송                                                                  | 생성 시 지정 | 명시적 action, 없으면 이동 안 함       |
| `WINBACK`                  | 비활성 단계 도달                                                                         | 참여         | 피드                                   |
| `SOCIAL_DIGEST`            | 친구 완료 활동 요약                                                                      | 참여         | 피드                                   |
| `NUDGE_SUGGEST`            | 비활성 맞팔 친구 감지                                                                    | 참여         | 친구 피드, ID가 없으면 피드            |
| `LUNCH_NUDGE`              | 점심까지 완료 0개                                                                        | 참여         | 피드                                   |
| `STREAK_AT_RISK`           | 스트릭 3일 이상 + 오늘 미완료                                                            | 참여         | 피드                                   |
| `WEATHER_MORNING`          | 오늘 할 일과 겹친 날씨·오늘 날씨 또는 위치 설정 안내                                     | 서비스       | 날씨 (옮기기 `DEEP_LINK` url, 아래)    |
| `WEATHER_EVENING`          | 내일 날씨 또는 위치 설정 안내                                                            | 서비스       | 날씨                                   |
| `PREMIUM_GRANT_ENDING`     | 보상 기간 종료 24시간 전 (1.13.0+). 1.15.0부터 거래 알림(광고성 동의 불필요)             | 거래         | 구독 화면                              |
| `PREMIUM_TRIAL_ENDING`     | 무료 체험 종료 3일 전. 서버 전용 타입이라 앱에는 `SYSTEM_NOTICE`로 보낸다(아래)          | 거래         | 구독 화면(`/settings/subscription`)    |
| `PREMIUM_RENEWAL_UPCOMING` | 연간 구독 자동 갱신 7일 전. 서버 전용 타입이라 앱에는 `SYSTEM_NOTICE`로 보낸다(아래)     | 거래         | 구독 화면(`/settings/subscription`)    |
| `INVITE_JOINED`            | 초대받은 사람이 수락해 친구가 됨 (1.13.0+)                                               | 거래         | 내 초대 화면 (`metadata.redemptionId`) |
| `INVITE_REWARDED`          | 초대한 사람의 발자국 보상 적용 (수락 1건에 1회, 프리미엄·친구 한도를 함께 적음, 1.13.0+) | 거래         | 내 초대 화면 (`metadata.redemptionId`) |
| `INVITE_PROGRESS`          | 초대받은 사람이 처음으로 할 일을 끝낸 날 초대한 사람에게 (수락 1건에 1회, 1.13.0+)       | 거래         | 내 초대 화면 (`metadata.redemptionId`) |
| `INVITE_QUALIFY_REMINDER`  | 하루만 더 하면 사용 시작인 초대받은 사람에게 마감 전 (수락 1건에 최대 1회, 1.13.0+)      | 참여         | 오늘 피드 (`metadata.redemptionId`)    |

`BROWSER`, `WEBVIEW`, `NONE` action은 표의 기본 이동보다 우선한다. `DEEP_LINK`에 URL이 있으면 해당 내부 경로를 우선한다.

할 일이 대상인 알림(`todoId`가 있는 댓글·답글·좋아요 `TODO_SHARED`, `TODO_REMINDER`, 할 일 콕 `NUDGE_RECEIVED`)은 `NotificationPublisher`가 발행할 때 그 할 일의 주인과 시작일을 `metadata.todoOwnerId`·`metadata.todoDate`(YYYY-MM-DD)로 더한다. 알림함은 metadata로, push는 payload `routing`으로 같은 값을 받는다(`notificationRoutingSchema`, 1.13.0+). 앱은 펼친 화면에서 목록 pane을 그 사람(친구면 친구 피드)의 그 날짜로 열고 상세 pane에 할 일을 고른다. 할 일이 이미 지워졌으면 더하지 않고, 이전 알림·이전 앱은 지금처럼 동작한다. `context`는 배포된 DTO 모양이라 늘리지 않는다.

공지(`SYSTEM_NOTICE`·`ADMIN_BROADCAST`·`ADMIN_TARGETED`)는 종류만으로 갈 곳을 정할 수 없어 `DEEP_LINK` url에 앱 경로를 싣는다. 경로는 `@aido/api/vocabulary`의 `NOTICE_DEEP_LINK_PATH`(`/feed`, `/achievements`, `/weather`, `/friends`, `/friends/invite`, `/settings/subscription`, `/settings/notifications`) 중에서만 고른다. 1.13.0 앱은 이 경로만 열고 모르는 경로·쿼리·상세 id 경로는 이동하지 않으며, 이전 앱은 url을 무시하고 지금처럼 앱만 연다. url은 추가 필드라 기존 payload·응답 모양은 바뀌지 않는다.

### 푸시 navigation (1.14.1+)

push data의 `navigation`은 알림을 눌렀을 때 열 화면을 `kind`로 판별하는 유니온이다(`@aido/api`의 `notificationNavigationSchema`, kind 값은 `@aido/api/vocabulary`의 `NOTIFICATION_NAVIGATION_KIND`). 서버는 `toNotificationNavigation`(Notification `application/services/delivery/notification-navigation.ts`) 하나에서 kind별 builder로 만들고, 앱은 `match(navigation).exhaustive()`로 목적지를 고른다.

| kind                 | 싣는 값                                                                                                                        | 알림                                                                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TODO_COMMENT`       | `todoId`, `commentId`, `threadCommentId`(대화 머리 댓글 = `routing.threadRootId`), `activityKind`, `todoOwnerId?`, `todoDate?` | 댓글·답글·좋아요(`TODO_SHARED`)                                                                                                                                       |
| `TODO`               | `todoId`, `todoOwnerId?`, `todoDate?`                                                                                          | 댓글 재료가 없는 `TODO_SHARED`, `TODO_REMINDER`, 할 일 콕                                                                                                             |
| `NUDGE`              | `nudgeId`                                                                                                                      | 할 일 콕, `NUDGE_REPLIED`·`NUDGE_THANKED`                                                                                                                             |
| `CHEER`              | `cheerId`, `friendId`                                                                                                          | `CHEER_RECEIVED`                                                                                                                                                      |
| `FRIEND_FEED`        | `friendId`                                                                                                                     | `FOLLOW_ACCEPTED`, `FRIEND_COMPLETED`, `NUDGE_SUGGEST`, 할 일 없는 콕                                                                                                 |
| `WEATHER_RESCHEDULE` | `todoIds`, `reason`                                                                                                            | 옮기기 링크가 있는 `WEATHER_MORNING`                                                                                                                                  |
| `EXTERNAL_URL`       | `url`(http(s)), `presentation`(`BROWSER`·`WEBVIEW`)                                                                            | `BROWSER`·`WEBVIEW` 액션                                                                                                                                              |
| 화면만               | —                                                                                                                              | `FEED`, `FRIENDS`, `FRIEND_REQUESTS`, `WEATHER`, `ACHIEVEMENTS`, `REPORTS`, `SUGGESTIONS`, `INVITE`, `SUBSCRIPTION`, `NOTIFICATIONS`, `NOTIFICATION_SETTINGS`, `NONE` |

목적지는 1.14.0 앱이 `type`·`action`·`context`·`routing`으로 고르던 곳과 같다. 그래서 `type`(`TODO_SHARED` 등 기존 값 포함)·`action`·`context`·`routing`은 구 앱 호환용으로 계속 함께 싣는다. 계약을 통과하지 못하는 값이면 `navigation`을 싣지 않고, 앱 schema도 모양이 틀린 `navigation`만 버려 기존 필드로 이동한다. 알림함 REST 응답(`NotificationListResponseDto`)은 배포 앱 fingerprint에 고정돼 있어 `navigation`을 더하지 않는다.

| 공지         | url                                                                                           |
| ------------ | --------------------------------------------------------------------------------------------- |
| Retention V2 | 단계 정책이 고른 `/feed` 또는 `/achievements`                                                 |
| 결제 문제    | `/settings/subscription`                                                                      |
| 온보딩 D0·D1 | `/feed`                                                                                       |
| 온보딩 D2    | `/friends`                                                                                    |
| 온보딩 D3    | `/settings/notifications` (시간을 고르는 리마인더 화면은 프리미엄 전용이라 알림 설정 첫 화면) |
| 온보딩 D5    | 완료 0개면 `/feed`, 1개 이상이면 `/achievements`                                              |
| 온보딩 D7    | `/achievements`                                                                               |

초대 알림의 중복 방지는 저장 원장이 소유한다.

- `INVITE_JOINED`: `InviteRedemption.inviteeId` UNIQUE로 수락 1건에 한 번.
- `INVITE_REWARDED`: 수락을 REWARDED로 바꾼 실행만 그 수락의 APPLIED 지급 합계로 보낸다. 지급이 나뉘어도 수락마다 한 번이다. 초대받은 사람은 수락 응답에서 보상을 보므로 보내지 않는다.
- `PREMIUM_GRANT_ENDING`: `NotifyEndingPremiumGrants`가 체험 안내와 같은 `BillingNoticeSweeper`로 돈다. 뒤에 다른 보상 기간이나 스토어 구독이 이어지는 기간은 후보에서 뺀다. 100건씩 `UPDATE … SET endingNotifiedAt WHERE endingNotifiedAt IS NULL RETURNING`으로 표시를 얻은 기간만 같은 트랜잭션에 알림을 기록해 기간마다 한 번이다.
- `PREMIUM_TRIAL_ENDING`: `premium-grant-sweep` 잡(같은 큐·잡 이름)이 보상 안내 뒤에 `NotifyEndingTrialsUseCase`를 돈다. 며칠 전 결제·보상 안내는 `SweepBillingNoticesUseCase` 하나가 묶음 읽기·야간 미루기·표시와 기록을 맡고, use case는 대상(source)·문구(notifier)·며칠 전·거르기 규칙만 넘긴다. 후보는 `periodType=TRIAL`·`trialEndingNotifiedAt IS NULL`·지금~3일 안에 끝나는 ACTIVE/CANCELLED 행을 `(expiresAt, id)` keyset으로 500건씩 최대 20묶음 읽는다. 시작할 때 이미 3일 이하로 남았거나 현지 야간인 사용자는 표시하지 않는다. 100건씩 `UPDATE … SET trialEndingNotifiedAt WHERE trialEndingNotifiedAt IS NULL RETURNING`으로 표시를 얻은 행만 같은 트랜잭션에 알림을 기록하므로 두 실행이 겹쳐도 한 번만 보낸다. 문구는 자동 갱신이면 "N일 뒤 {요금제}이 시작돼요 / 12월 9일 결제 예정 · 해지는 스토어에서"이고 요금제는 상품 ID로 정한 연간 구독·월간 구독, 모르는 상품이면 "구독"이다(`SubscriptionPlanPolicy`, Play의 `상품:기본요금제`는 `:` 앞만 본다). 해지했으면 "무료 체험이 N일 뒤 끝나요 / 12월 9일까지 이용 · 결제는 없어요"다. N과 날짜는 받는 사람 시간대 달력으로 센다(`calendarDaysBetween`). 체험 끝은 스토어 `expiration_at_ms` 그대로이고 서버가 체험 길이를 계산하지 않는다. 금액은 체험 구매 웹훅에 없어 싣지 않는다.
- `PREMIUM_RENEWAL_UPCOMING`: 같은 잡이 체험 안내 뒤에 `NotifyUpcomingRenewals`를 돈다. 후보는 ACTIVE·`periodType` NORMAL(또는 null)·지금~7일 안에 끝나고, 다음 결제 상품(`nextProductId ?? productId`의 `:` 앞)이 연간이며, 그 사용자의 현재 체인(`currentStoreChainOf`: 유효한 체인 중 가장 늦게 시작한 체인, `/me`와 같은 규칙)인 행이다. Play는 요금제를 바꾸면 새 체인이 생기고 옛 체인이 원래 만료까지 ACTIVE로 남아, 옛 체인은 건너뜀(`skippedCount`)으로 센다. `Subscription.renewalNoticeExpiresAt`에 알린 기간의 `expiresAt`을 남겨 `renewalNoticeExpiresAt IS DISTINCT FROM expiresAt`인 행만 표시하므로 기간마다 한 번이고, 갱신으로 `expiresAt`이 바뀌면 다음 기간에 다시 보낸다. 표시는 읽은 만료 시각과 같을 때만 해 읽은 뒤 갱신된 행의 다음 기간을 미리 표시하지 않는다. 문구는 "N일 뒤 연간 구독이 갱신돼요 / 11월 9일 결제 예정 · 해지는 스토어에서"(en "Your annual plan renews in N days / Billing on Nov 9 · Cancel in your store")이고 금액은 국가별 스토어 가격이라 싣지 않는다. 캠페인 키 `premium_renewal_upcoming_v1`, metadata `{ subscriptionId }`.
- 세 안내 단계(보상 종료·체험 종료·연간 갱신)는 보상 정리 뒤 순서대로 각각 돌고, 한 단계가 실패해도 나머지를 보낸 뒤 잡을 실패로 끝내 pg-boss 재시도에 맡긴다(`billing.premium-grant.sweep.step.failed`의 `step`). 각 단계는 조건부 표시라 재실행에 멱등이다.
- `INVITE_PROGRESS`: 활동일 기록이 수락 행 잠금(`FOR UPDATE`)으로 직렬화되어 활동일이 0→1일로 바뀐 실행만 커밋 뒤 보낸다. 백필하지 않아 지난 소식을 보내지 않는다.
- `INVITE_QUALIFY_REMINDER`: 정비 작업이 후보(JOINED·미발송·초대한 사람 있음·보상 자격 있음·마감이 지금~3일 안)를 `(expiresAt, id)` keyset으로 500건씩 최대 20묶음 읽고, 할 일을 끝낸 날이 1일인 수락만 초대받은 사람 시간대(미상·UTC는 KST)의 다음 18:00에 `startAfter`로 넣는다(키 `invite-qualify-reminder:<수락>:<발송 시각>`).
  - 보낼 때 수락 행을 잠그고 자격·야간 여부·두 사람이 아직 친구이고 차단이 없는지·초대한 사람이 탈퇴하지 않았는지를 다시 본다. `InviteRedemption.qualifyReminderSentAt`과 알림 기록을 같은 트랜잭션에 남기고 푸시는 커밋 뒤 나간다.
  - 건너뛴 수락은 표시하지 않아 마감 전 다음 정비 실행이 다시 고른다. 참여 목적이라 동의·야간·하루 한도에 걸리면 알림함에만 남는다.
- 광고성 동의 재확인: 정보통신망법 시행령 제62조의 2년 고지다. `UserConsent`에서 동의(또는 마지막 재확인)가 24개월 전(`marketingReconfirmCutoff`) 이전인 활성 사용자를 userId keyset으로 500명씩 읽고, 100명씩 `UPDATE … SET marketingReconfirmedAt WHERE … 아직 대상 RETURNING`으로 표시를 얻은 사용자만 같은 트랜잭션에 알림을 남긴다. 문구는 "광고성 알림 수신에 동의 중이에요 / 2024.11.09 동의 · 설정에서 바꿀 수 있어요"이고 이동은 `/settings/notifications`다. 이메일 고지는 아직 없다.
- `INVITE_ENABLED=false`면 두 알림을 보내지 않는다. 활동일·사용 시작과 지급 원장(PENDING)만 기록하고 지급 작업을 멈춘다. 다시 켜면 다음 정비 작업(매일 03:30 KST)이 남은 PENDING·FAILED 지급을 적용하므로 보상은 잃지 않는다.

## 날씨 알림

`WeatherMorningStrategy`·`WeatherEveningStrategy`는 앱 날씨 화면과 같은 v2(WeatherKit) 리포트를 weather Context의 공개 capability(`WEATHER_REPORT_READER` → notification의 `REMINDER_WEATHER_REPORT_READER`)로 읽는다. v1 KMA 격자 예보는 쓰지 않으므로 격자가 없는 해외 위치(1.14.0+)도 날씨 알림을 받는다.

1. 대상: 설정 시각이 맞고 날씨 알림을 켠 활성 사용자 중 위치가 있고 오늘 같은 알림을 받지 않은 사용자만. 이 단계 뒤에만 리포트·할 일을 조회하므로 대상이 아닌 사용자로 WeatherKit을 부르지 않는다. 날씨 알림은 야간 예외 타입이다.
2. 리포트: `GetWeatherReport`와 같은 `WeatherReportReader.readReport`(geohash5 칸 캐시 `weather:v2:report:<칸>:<scope>`, `CacheService.wrap` single-flight, 평소 30분·2시간 안 강수 10분 TTL → 실패 시 6시간 latest 스냅샷 → 칸별 1분 공급자 실패 캐시)를 쓴다. 같은 칸·언어 요청은 한 번만 읽고 칸은 4개씩 동시에 읽는다. 화면과 캐시를 공유하므로 **리포트용 WeatherKit `weather` 호출은 칸·scope(특보가 있는 칸만 언어별, 나머지는 공유)마다 리포트 TTL당 최대 1회(프로세스별 single-flight)**이며 알림 사용자 수에 비례하지 않는다. 이와 별도로 가용성 조회는 칸마다 7일, 출처 표기(attribution)는 언어마다 7일 캐시하고, 둘 다 실패하면 1분 동안 다시 부르지 않는다(가용성은 기본 dataset, 표기는 로고 없이 진행).
3. 할 일(아침만): 오늘(알림 시간대) 남은 시각 지정·미완료·종일 아님 할 일(`scheduledTime ∈ [지금, 오늘 자정)`).
4. 판단(`weather-briefing.policy.ts`, 앱 아이두 브리핑과 같은 규칙·`@aido/api/vocabulary`의 `WEATHER_BRIEFING_RULES`): 시간별 강수 확률 50% 이상 = 비, 낮 체감 33°C 이상 = 더위, `THUNDERSTORMS` = 뇌우, 눈·진눈깨비·우박 = 눈, 최저 10°C 이하 = 쌀쌀. 아침은 할 일과 겹친 비·뇌우·눈 → 할 일과 겹친 더위 → 오늘 늦게 오는 비·눈 → 오늘 요약(상태·최고/최저·강수 확률) 순, 저녁은 내일 비·눈이 시작하는 때(새벽·오전·오후·저녁) 또는 내일 요약에 쌀쌀함을 더한다. 시각과 오늘·내일은 알림 시간대(기기), 일별 예보는 위치 시간대 날짜로 찾는다.
5. 폴백: 캐시·latest 스냅샷까지 없으면 틀린 날씨 대신 "앱에서 확인" 안내(`weather.*.unavailable`)를 보낸다. KMA로 다시 읽지 않는다.

비·뇌우·더위와 겹친 할 일 알림은 `action: { type: "DEEP_LINK", url: "/weather/reschedule?todoIds=12,15&reason=rain|heat" }`를 싣는다. url은 `@aido/api/vocabulary`의 `buildWeatherRescheduleDeepLink`(경로 `WEATHER_RESCHEDULE_DEEP_LINK`, 이유 `WEATHER_RESCHEDULE_REASONS`)로 만든다. 1.13.x 이하 앱은 날씨 알림을 종류로만 이동하므로 url을 무시하고 지금처럼 `/weather`를 연다. 1.14.0 앱은 `notification-destination.ts`가 이 url을 읽어 옮기기 화면을 바로 연다.

## 문구와 변형 선택

- 한국어와 영어 카탈로그는 키, variant 수, 플레이스홀더가 항상 같아야 한다.
- 한국어 푸시는 모든 카탈로그가 앱 화면과 같은 해요체를 쓴다. 보조 용언은 붙여 쓰고(`해볼까요`, `적어봐요`), 합니다체와 섞지 않는다. 사람 이름에는 `님`을 붙이고 이름을 모르면 `친구`를 쓴다. 죄책감·조롱·가짜 긴급함·과한 유행어는 쓰지 않는다.
- 친구가 앱에서 고른 콕 답장 라벨(`REPLY_LABEL`)처럼 사용자가 보낸 말은 앱 버튼 문구 그대로 인용한다.
- 영어는 sentence case와 축약형을 쓰는 자연스러운 표현으로 쓰고 한국어를 직역하지 않는다. 문장 중간에서 이름을 모르는 친구는 `your friend`로 부른다.
- 결제·계정·보안 알림은 농담 없이 명확하게 쓴다.
- 카피를 바꾸면 `NOTIFICATION_COPY_REVISION`을 해당 릴리스 버전으로 올려 `metadata.copyRevision`으로 이전 문구와 성과를 나눈다.
- 제목은 60자, 본문은 120자 이하이며 한 줄의 이모지는 최대 1개다.
- 반복 캠페인은 `campaignKey + templateKey + recipientId + occurrenceKey`로 variant를 결정한다. 같은 사용자·같은 발생 건은 재시도나 서버 재시작 뒤에도 문구가 바뀌지 않는다.
- `templateKey`는 아침 할 일 유무, 저녁 진행 상태, 날씨 조건처럼 한 캠페인 안의 의미상 다른 카피 풀을 구분한다. `variantId`에도 포함되므로 서로 다른 문구가 같은 ID로 집계되지 않는다.
- `campaignKey`는 카피나 대상 정책이 바뀔 때만 버전을 올린다. `variantId`는 실제 선택된 문구를 함께 기록한다.
- 사용자 작성 메시지와 결제·운영 공지는 내용을 임의로 변형하지 않는다.

## 타임존 처리

배송·야간 자격 경로는 미상/무효 및 저장 기본 UTC를 KST로 해석하는 `resolveDeliveryTimezone`을 사용한다. 일반 날짜 계산의 UTC fallback과 별도 정책이다.

- 푸시 토큰 등록의 `X-Timezone`이 없으면 기존 저장값을 유지한다. 값이 바뀌면 할 일 시각을 다시 계산한다([떠 있는 시각](todo-floating-time.md#시간대-변경)).
- 등록은 `(userId, deviceId)` 기준 upsert다. 같은 토큰을 다른 사용자나 다른 deviceId가 가지고 있으면(이전 사용자의 해제 요청이 실패한 기기에 새 사용자가 로그인 등) 같은 트랜잭션에서 그 등록을 지우고 새로 등록해 토큰 소유를 옮긴다. 이전 소유자의 토큰 캐시도 비우고 `notification.delivery.register-push-token.owner-transferred`(새·이전 userId만, 토큰 값 없음)를 남긴다. 같은 토큰이 동시에 등록돼 `PushToken_token_key` 충돌이 나면 `notification.delivery.register-push-token.conflict-retried`(warn)를 남기고 새 트랜잭션에서 해제+upsert를 한 번만 다시 한다. 재시도도 충돌하면 기존처럼 DB 오류로 응답한다. 요청 형태는 바뀌지 않는다.
- 설정 API의 잘못된 IANA 타임존은 `400 SYS_0002`로 거부한다. 유효한 별칭은 런타임의 정규 IANA 이름으로 저장한다.
- 일반 API에서 누락·오류 타임존 값은 `UTC`로 처리한다.
- 과거에 잘못 저장된 값은 활성 스케줄 타임존 목록에서 제외하고, 날짜 계산이 필요한 방어 경로에서는 `UTC`로 폴백한다.
- 과거에 저장된 유효한 IANA 별칭은 원래 저장값으로 스윕해 조회 조건과 일치시킨다. 이를 정규 이름으로만 합치면 기존 별칭 사용자가 누락되므로, 신규 입력부터 점진적으로 정규화한다.
- 모든 고정 시각, 로컬 날짜 중복 키, 참여 유도 일일 한도는 IANA 타임존과 DST를 반영한다.

## 구버전 클라이언트 호환성

v1.0.0~v1.4.0이 요구한 푸시 data 필드 `notificationId`, `type`, `action`, `context`의 이름과 의미는 바꾸지 않는다. v1.5 계열의 `dispatchId`, `campaignKey`, `variantId`, `purpose`, `marketingOptOutToken`은 모두 optional 추가 필드다. 1.14.1의 `navigation`도 optional 추가 필드다. 과거 Zod object는 알 수 없는 optional 필드를 제거하므로 그대로 파싱된다.

호환성 테스트는 Git 릴리스 이력의 실제 알림 타입 enum을 반영한 v1.0–v1.1, v1.2–v1.4 스키마와 현재 `pushNotificationDataSchema`로 같은 서버 payload를 각각 파싱한다. OpenAPI paths/components 스냅샷도 별도로 고정한다.

앱 계약 enum(`@aido/api` `NOTIFICATION_TYPE`)에 없는 서버 전용 타입(`PREMIUM_TRIAL_ENDING`·`PREMIUM_RENEWAL_UPCOMING`)은 `notification-client-capability.ts`의 `toWireNotificationType` 한 곳에서 푸시 `type`과 알림함 `type`을 `SYSTEM_NOTICE`로 바꿔 보낸다. 저장·중복 방지·카테고리(`NOTICE`)·`navigation`(`SUBSCRIPTION`)은 서버 타입으로 정하고, `DEEP_LINK` url `/settings/subscription`을 함께 실어 1.13.0+ 앱도 구독 화면을 연다. 그래서 최소 앱 버전이 없고 모든 앱이 받는다.

새 알림 타입의 최소 앱 버전은 `notification-client-capability.ts`의 `NOTIFICATION_MIN_APP_VERSION` 한 곳에서 정한다(`NUDGE_REPLIED`·`NUDGE_THANKED` 1.11.0, `INVITE_JOINED`·`INVITE_REWARDED`·`INVITE_PROGRESS`·`INVITE_QUALIFY_REMINDER`·`PREMIUM_GRANT_ENDING` 1.13.0). 알림함 조회·미읽음 수·전체 읽음과 푸시 토큰 필터가 같은 함수를 쓰므로 그보다 낮은 `X-App-Version`(또는 헤더 없음)에는 해당 알림이 보이지 않고 그 버전 미만 기기로 푸시하지 않는다. 미읽음 수 캐시는 지원 단계(`legacy`·`since-1.11.0`·`all`)마다 나눈다.

소셜 다이제스트 지연 잡은 직전 저녁 리마인더의 알림 생성 대상 사용자 CUID 목록을 함께 저장한다. 배포 전에 생성되어 대상 목록이 없는 구형 지연 잡은 타임존 전체로 확대 발송하지 않고 안전하게 건너뛴다.

## Delivery·receipt·롤아웃

알림 기록, PushDispatch와 outbox, 외부 공급자 발송은 분리된다. 알림을 만드는 모든 경로(소셜·리마인더·리텐션·관리자 브로드캐스트)는 같은 transaction에서 `Notification`·`PushDispatch`·`PushDispatchOutbox`를 쓰고, commit 뒤 `push-delivery.v1` 작업이 발송한다. worker는 publication generation·job ID·delivery attempt fence로 claim/finalize/retry를 제한한다. stale worker가 새 generation을 끝내지 못하게 하는 내부 원자성은 외부 푸시 exactly-once와 다르다.

공급자 경계는 채널 중립 `PushProvider` Port다(현재 Expo, 이후 FCM·Web Push). 공급자 오류 코드는 Adapter 안에서 `PushFailureKind`로 바꾼다.

| PushFailureKind        | Expo 원본                                                  | 처리                                                    |
| ---------------------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| `DEVICE_UNREGISTERED`  | `DeviceNotRegistered`                                      | 발송 당시 토큰이 그대로면 비활성화                      |
| `INVALID_TOKEN`        | SDK 토큰 형식 검사 실패                                    | 비활성화                                                |
| `PAYLOAD_TOO_LARGE`    | `MessageTooBig`, 4096 byte 초과                            | 실패 기록, 토큰 유지                                    |
| `RATE_LIMITED`         | `MessageRateExceeded`                                      | 그 메시지만 1·2·4초 backoff 뒤 재전송, 남으면 실패 기록 |
| `PROVIDER_REJECTED`    | `InvalidCredentials`, `DeveloperError`, `MismatchSenderId` | 실패 기록                                               |
| `PROVIDER_UNAVAILABLE` | `ExpoError`, `ProviderError`                               | 실패 기록                                               |
| `RECEIPT_EXPIRED`      | receipt 보관 기간(약 24시간) 안에 결과 없음                | `UNKNOWN`으로 닫음                                      |
| `UNKNOWN`              | 그 밖의 코드                                               | 실패 기록                                               |

`PushDeliveryAttempt.failureKind`가 판단 기준이고 `errorCode`·`errorMessage`는 공급자 원본 진단 기록이다. 코드의 `providerTicketId`는 기존 컬럼 `expoTicketId`를 그대로 쓴다(운영 데이터를 옮기지 않으려고 컬럼 이름은 바꾸지 않았다).

공급자 처리량: Expo 프로젝트 한도는 초당 600건이다. Adapter가 프로세스 안에서 초당 500건 토큰 버킷으로 청크(100건) 전송을 직렬화하고, SDK가 HTTP 429를 backoff 재시도하며 동시 요청을 6개로 제한한다. 운영 API는 단일 프로세스라 이 한도가 곧 전체 한도다. 인스턴스를 늘리면 `EXPO_PUSH_MESSAGES_PER_SECOND`를 인스턴스 수로 나눠야 한다.

receipt 확인은 5분마다 돈다(Expo 권장대로 수락 15분 뒤부터 묻으므로 매분 돌 이유가 없다). 한 실행은 45초 예산 안에서 900건씩 남은 ticket이 없을 때까지 이어서 확인한다. 대상은 수락 뒤 15분~24시간이고 아직 확인하지 않았거나 마지막 확인이 15분 지난 `TICKET_ACCEPTED`이며, 확인 시각이 오래된 순서다. 결과가 아직 없는 ticket은 확인 시각만 남겨 뒤로 보내므로 오래된 ticket이 배치 앞자리를 계속 차지하지 않는다. 24시간이 지나도 결과가 없으면 `UNKNOWN`·`RECEIPT_EXPIRED`로 닫는다.

receipt 갱신은 `TICKET_ACCEPTED`에만 원자적으로 적용한다. 이미 DELIVERED/FAILED인 ticket의 중복 응답은 되돌리지 않는다. 토큰을 끄는 실패는 저장된 발송 token SHA256과 현재 token이 같을 때만 비활성화 대상으로 반환한다. receipt 상태와 token 비활성화는 하나의 UNIT_OF_WORK에서 처리하고 실패 시 함께 rollback한다. commit 뒤 user별 token cache invalidation은 allSettled로 실패를 격리해 기록한다.

남는 한계:

- 보호는 이미 저장된 발송 당시 A fingerprint와 현재 B token 비교에 적용된다. network send 도중 token 회전으로 기존 token 문자열 lookup이 실패하면 attempt가 생략될 수 있다.
- 같은 token을 다시 등록하는 ABA 등록 세대는 SHA256만으로 구별하지 못한다.
- 앞 청크가 수락된 뒤 다음 청크 transport가 실패하면 전체 논리 배치 retry에서 중복 전달이 가능하다. 원문/token/body/credential은 로그에 남기지 않는다.
- receipt는 외부 provider handoff 결과다. 기기 알림 표시·사용자 열람·운영 exactly-once를 보장하지 않는다.

## 푸시 기기와 토큰

앱은 기기마다 알림 권한과 Expo 토큰을 서버에 보고한다. 서버는 권한을 해석해 도달 가능 여부와 건너뜀 사유를 정하고, 앱은 OS 권한과 토큰을 읽어 보고만 한다.

| 책임   | 서버                                                                                                                           | 앱                                                                                       |
| ------ | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| 권한   | 보고된 `PushPermission`(`GRANTED`·`PROVISIONAL`·`DENIED`·`NOT_DETERMINED`)을 저장한다. `PROVISIONAL`도 발송한다                | OS 권한을 읽어 로그인 직후·앱 복귀·토큰 변경·언어 변경 때 보고한다                       |
| 플랫폼 | `deviceId` 접두어 `ios_`·`android_`로 정한다(`platformFromDeviceId`). 접두어가 없으면 `X-Device-Type`을 쓰고, 둘 다 없으면 400 | 접두어가 붙은 `deviceId`를 만든다                                                        |
| 토큰   | 기기·로그인 세션에 묶어 저장하고 `DeviceNotRegistered`면 비활성화하고 소유권 이전·세션 폐기 때 지운다                          | Expo 토큰을 얻어 보고한다. 로그아웃 때 해제 요청을 보내도 서버가 세션 폐기로 다시 지운다 |
| 사유   | 활성 토큰이 없으면 기기 권한으로 건너뜀 사유를 정한다                                                                          | 사유를 알지 못한다                                                                       |

- 엔드포인트: `PUT /v1/notifications/push-devices/{deviceId}`(기기 보고, 1.14.2+). 1.14.1 이하 앱의 `POST`·`DELETE /v1/notifications/token`은 deprecated이며 같은 UseCase(`ReportPushDevice`·`UnregisterPushDevice`)로 위임한다. 이전 앱의 등록은 권한 `GRANTED`로 저장한다.
- 세션 결속: `PushDevice`·`PushToken`의 `sessionId`는 `Session`을 참조하며 `ON DELETE CASCADE`다. identity가 세션을 폐기하면(로그아웃·전체 로그아웃·비밀번호 변경·재설정·원격 종료·토큰 재사용 감지·탈퇴) `SESSION_PUSH_DEVICE_RELEASER` Port로 notification의 `SESSION_PUSH_DEVICE_RELEASE` capability를 불러 그 세션의 기기와 토큰을 바로 지운다. 해제가 실패해도 세션 폐기는 막지 않고 `identity.session.push-device-release.failed`(warn)만 남긴다. 만료돼 정리되는 세션은 CASCADE로 함께 지워진다. `sessionId`가 없는 1.14.1 이하 등록은 그대로 둔다.
- 건너뜀 사유: 활성 토큰이 없으면 최근 `PUSH_DEVICE_STALE_AFTER_DAYS`(90일) 안에 보고한 기기의 권한으로 정한다(`noActiveTokenSkipReason`).

| 사유                            | 조건                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| `NO_ACTIVE_TOKEN`               | 허용된 기기가 있거나, 보고한 기기가 없거나(1.14.1 이하 앱) 모든 보고가 90일을 넘음 |
| `PUSH_PERMISSION_NOT_REQUESTED` | 허용된 기기가 없고 `NOT_DETERMINED` 기기가 있음. 거절보다 먼저 센다                |
| `PUSH_PERMISSION_DENIED`        | 허용된 기기가 없고 `DENIED` 기기만 있음                                            |

관리자 캠페인 조회(`GET /v2/admin/notifications/broadcasts/{campaignId}`)의 `dispatches`가 사유별 수 `skippedByReason`을 돌려준다(추가 필드).

## 큐와 작업 key

큐 이름은 운영 계약이다. 새 큐는 `<context>.<purpose>.v1`, 작업 이름은 kebab-case로 짓고, 기존 큐는 남은 작업을 잃지 않도록 이름을 바꾸지 않는다. 큐마다 `push/infrastructure/jobs/*.queue.ts`의 `defineQueue` 정의 하나가 이름·payload zod schema·재시도·DLQ·worker·예약을 소유하고 `JobQueuePort`가 소비 때 그 schema로 입력을 검증한다. 예약 작업(`push-receipts`·`relay-outbox`)은 옛 스케줄처럼 DLQ 없이 같은 이름의 예약 전용 정의로 등록한다. 같은 원인 이벤트의 작업은 pg-boss `singletonKey`와 결정적 job id로 한 번만 저장된다.

| 큐                                            | 작업                                                                                                                   | key                                                                                                                                                                                      | 실패                                                              |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `notification.v1`                             | follow·nudge·cheer·billing·friend-completed·milestone                                                                  | `nudge-<id>`, `cheer-<id>`, `follow-new-<a>-<b>`, `follow-mutual-<user>-<friend>`, `billing-issue-<user>-<UTC 날짜>`, `friend-completed-<friend>-<현지 날짜>`, `milestone-<user>-<단계>` | 2회 재시도 뒤 `notification-dead-letter.v1`(14일 보관, 기록만)    |
| `notification.v1`                             | `push-receipts`(5분 예약, `missed: skip`)                                                                              | 예약 key `push-receipts-scheduler`                                                                                                                                                       | 2회 재시도                                                        |
| `push-delivery.v1`                            | `deliver-dispatches`(거래성 `priority 10`·마케팅 `0`, 일반 worker + `minPriority 10` worker), `relay-outbox`(1분 예약) | publication 집합의 SHA256                                                                                                                                                                | 5회 재시도 뒤 `push-delivery-dead-letter.v1`가 outbox를 다시 연다 |
| `operations.broadcast-fan-out.v1`             | `fan-out-campaign`                                                                                                     | `broadcast-fan-out-<campaignId>-<cursor 또는 start>`                                                                                                                                     | 5회 재시도 뒤 DLQ가 캠페인을 `FAILED`로 닫음                      |
| `operations.broadcast-delivery.v1`            | `deliver-group`(수신자 현지 시각 발송, `startAfter`)                                                                   | `broadcast-delivery-<campaignId>-<startAfter>-<첫 사용자>`                                                                                                                               | 5회 재시도 뒤 DLQ가 운영 경보만 올림                              |
| `retention.v1`                                | `retention-stage-sweep`(매분 예약, `missed: once`)                                                                     | 예약 key                                                                                                                                                                                 | 4회 재시도                                                        |
| `notification.marketing-consent-reconfirm.v1` | `reconfirm-marketing-consents`(매시 정각 `missed: skip`, 현지 야간 사용자는 다음 낮 실행으로)                          | 예약 key `hourly-marketing-consent-reconfirm-scheduler`                                                                                                                                  | 2회 재시도. 멱등은 `marketingReconfirmedAt` 조건부 UPDATE         |
| `todo-reminder.v1`, `timezone-reminder.v1`    | 리마인더, `send-series-paused-notice`                                                                                  | `reminder_<todoId>_<단계>`(`60min`·`10min`), `series-paused_<userId>_<마지막 활동일>`                                                                                                    | 기존 정책                                                         |

다른 Context의 큐(`email-delivery.v1`, `admin-notification.v1`, `todo-timezone-rebase.v1`, `todo-series-materialization.v1`, `quota-abandoned-refund.v1` 등)도 같은 규칙이고 각 Context의 큐 상수 모듈에 있다.

key builder는 `notification-job-keys.ts`(알림 Context)와 각 큐 상수 모듈에 순수 함수로 있다. 다른 Context는 커밋 뒤 `NotificationQueueService`로 이벤트를 넘기며 결과를 기다리지 않는다. 일시적인 저장 실패는 200ms 간격으로 3번 다시 시도하고, 그래도 실패하면 작업 이름과 오류 종류만 error로 남긴다. 종료 시 저장 중인 이벤트는 job runtime이 멈추기 전에 마친다.

DB 연결: 앱 풀(`DATABASE_POOL_MAX` 기본 10)과 pg-boss 풀(`max: 3`)은 따로다. 각 작업은 짧은 transaction(claim·finalize·outbox 쓰기) 동안만 연결을 잡고 Expo 호출과 commit 뒤 enqueue 중에는 잡지 않는다. fan-out 한 페이지는 알림·dispatch·outbox 500건씩을 한 transaction에 쓴다. worker들이 동시에 연결을 원하면 HTTP 요청이 잠시 풀을 기다리므로 worker 동시성(큐 상수 모듈)을 늘릴 때는 풀 크기를 함께 본다.

## 관리자 브로드캐스트 캠페인

`POST /v2/admin/notifications/broadcasts`는 캠페인을 만들고 첫 분배 작업을 같은 transaction에 등록한 뒤 202와 `campaignId`를 돌려준다. 요청 ID가 같은 재요청은 처음 캠페인을 돌려주고(내용이 다르면 409 `ADMIN_1405`), 대상이 없으면 404 `ADMIN_1402`다. 관리자마다 분당 5회까지다.

분배 작업은 대상 사용자를 ID 순서로 500명씩 읽어 수신자 언어의 문구(`localizedContent`, 없으면 `title`·`body`)로 캠페인 key(`admin-broadcast:<campaignId>`)가 붙은 알림을 만든다. `delivery`가 `RECIPIENT_LOCAL_TIME`이면 알림 대신 시각별 발송 작업(`operations.broadcast-delivery.v1`)을 등록한다. 분배·발송 작업은 마케팅 차선(`priority: 0`)이다. 페이지 저장과 cursor 전진이 한 transaction이라 worker가 죽어도 다음 시도가 마지막 커밋 cursor부터 이어 가며, 한 실행이 60초를 넘기면 다음 cursor 작업을 남긴다. 탈퇴·정지된 사용자는 다음 페이지 조회에서 빠지고, 수신 설정·야간·빈도 제한·토큰 상태는 발송 시점에 공용 정책으로 판단한다.

`GET /v2/admin/notifications/broadcasts/{campaignId}`는 분배 진행(`recipients.processed`·`queued`), 사용자별 발송 상태(`dispatches`), 기기별 전달 결과(`deliveries`)를 집계한다. `queued`는 알림을 만들어 대기열에 올린 수이며 전달 수가 아니다. v1 `POST /v1/admin/notifications/broadcast`는 deprecated다. 같은 캠페인으로 접수하고 기존 응답 shape(`successCount`=대기열에 올릴 대상 수)를 유지한다.

리텐션 실험은 단계 정책·예약만 소유한다. 발송할 단계는 공용 알림 발행(`purpose=ENGAGEMENT`, 단건 dispatch)으로 넘기므로 빈도 제한·광고성 동의·야간 억제·토큰 정리·receipt가 다른 알림과 같다.

외부 제약: [Expo 공식 sending 문서](https://docs.expo.dev/push-notifications/sending-notifications/)는 15분 receipt 확인과 24시간 보관, 초당 600건 한도와 `MessageRateExceeded` backoff를 설명한다.
