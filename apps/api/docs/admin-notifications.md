# 관리자 알림

운영 채널(가입)과 결제 채널(구독)로 가는 관리자 알림을 바꿀 때 읽는다. Application(`src/modules/operations/admin-notices/application`)은 채널에 상관없는 알림 사실(`AdminNotice`)만 만든다. 제목·이모지·색·필드 배치·날짜 표시는 채널 어댑터가 정하고, Discord는 `admin-notices/infrastructure/adapters/discord-*.mapper.ts` 한 곳에 있다. 지금 어댑터는 Discord와 로그(`ADMIN_NOTIFIER_PROVIDER=log`)이며, 다른 채널은 어댑터와 `admin-notifier-selection.adapter.ts` 표에 한 줄을 더해 붙인다.

| `AdminNotice.type`   | 내용                                                     | 만드는 곳                                     |
| -------------------- | -------------------------------------------------------- | --------------------------------------------- |
| `subscription_event` | 사용자 블록 + 결제 블록(`SubscriptionNotice`)            | `EnqueueSubscriptionEvent`(billing 커밋 뒤)   |
| `user_registered`    | 사용자 블록 + 가입 요청의 기기·앱 정보(`SignupNotice`)   | `EnqueueUserRegistered`                       |
| `message`            | 이미 조립한 일반 알림(`AdminNotification`, 일일 요약 등) | `DispatchDailySignupSummary`, 이전 형식 큐 잡 |

발송은 `admin-notification.v1` 큐 잡으로 처리해 채널 실패가 회원가입·웹훅 처리를 막지 않는다. 일시 실패(429·5xx·연결 실패)만 큐가 2회까지 다시 시도하고, 채널이 거절한 요청(그 밖의 4xx)은 다시 보내지 않고 운영 경보(`operations.admin-notification.rejected`)를 올린다. webhook이 설정되지 않은 채널은 건너뛴다.

큐 잡 데이터는 `{ channel, notice }`다. 배포 순간 큐에 남은 이전 잡(보관 24시간)은 그 모양 그대로 `message`로 보낸다. 조립 메시지(`{ channel, notification }`, `LegacySendDataSchema`)와 그 전 형식(`color`·`fields[].name`, `LegacyAdminNotificationSchema`, 색은 info로)이 해당하고 제거 조건은 [호환](../../../docs/conventions/compatibility.md#2-외부-계약-바꾸지-않는다)에 있다. 표시에만 쓰는 값(스토어·사유·가입 방식 등)이 모르는 값이면 잡을 버리지 않고 그 칸만 비운다.

일반 메시지(`message`)의 `severity`는 채널 색으로 바뀐다: info 파랑·success 초록·warning 노랑·critical 빨강. 시각 필드는 보는 사람의 시간대로 보여 준다.

## 사용자 블록

가입·결제 알림은 같은 사용자 블록을 같은 순서로 맨 앞에 둔다. 한 줄에 셋씩 놓인다. 값이 없으면 `—`다.

| 필드      | 값                                                                          |
| --------- | --------------------------------------------------------------------------- |
| 닉네임    | 프로필 이름. 본문은 닉네임이 없으면 이메일 앞부분으로 부른다                |
| 태그      | `#userTag`                                                                  |
| 가입 방식 | 처음 만든 인증 계정의 공급자: 이메일 / Apple / Google / Kakao / Naver       |
| 가입일    | KST 날짜와 가입 뒤 지난 날 (`2026-10-01 (D+40)`, 당일은 `(D+0, 오늘 가입)`) |
| 이메일    | 전체 이메일. 가입·결제 알림이 같은 규칙이다(내부 운영 채널, 가리지 않음)    |
| 사용자 ID | 내부 사용자 ID                                                              |

사용자 블록은 `AdminNoticeUserReaderPort`(`DrizzleAdminNoticeUserReader`: `User`·`UserProfile`·첫 `Account`)로 채운다. 업무 트랜잭션이 커밋된 뒤 큐에 넣기 직전에 읽으며, billing·identity Application은 이 조회를 모른다. 사용자가 없거나 조회가 실패하면 알림을 버리지 않고 호출한 Context가 준 값(이메일·이름, 가입은 가입 방식·시각)으로 보낸다. 실패 로그는 `operations.notifications.user-lookup.failed`(`userId`·`errorType`)뿐이다.

## 결제 알림

RevenueCat 웹훅이 처리 원장에 새로 기록되고 구독 상태가 바뀐 이벤트만 알림을 보낸다. 같은 이벤트 ID의 재전송·중복 처리와 `TEST`·미지원 이벤트는 알림이 없다. 이벤트 ID가 실려 오면 `subscription-event_<eventId>` 잡 ID로 한 번만 큐에 등록한다. 알림 등록은 커밋 뒤 기다리지 않고(fire-and-forget) 실패해도 구독 반영을 되돌리지 않는다.

색은 돈의 흐름으로 고정한다: 들어온 돈 초록, 잃었거나 잃을 위험 빨강, 해지 예고 노랑, 정보 파랑. 제목 앞에 환경 배지 `[운영]`/`[샌드박스]`를 붙인다(환경을 모르면 없음). 샌드박스도 같은 색이고 본문·환경 칸에 매출이 아님을 적는다.

| 알림 이벤트(`SubscriptionNotice.event`) | 웹훅                                              | 제목                      | 색   | 기간 끝 칸            |
| --------------------------------------- | ------------------------------------------------- | ------------------------- | ---- | --------------------- |
| `purchased`                             | `INITIAL_PURCHASE`                                | 🎉 새 구독                | 초록 | 다음 갱신             |
| `one_time_purchased`                    | `NON_RENEWING_PURCHASE`                           | 🛒 일회성 구매            | 초록 | 기간 끝               |
| `trial_converted`                       | `RENEWAL` + `is_trial_conversion`                 | 💰 체험 → 유료 전환       | 초록 | 다음 갱신             |
| `renewed`                               | `RENEWAL`                                         | 🔄 구독 갱신              | 초록 | 다음 갱신             |
| `trial_started`                         | `INITIAL_PURCHASE` + `period_type=TRIAL`          | 🌱 무료 체험 시작         | 파랑 | 체험 끝 (첫 결제)     |
| `uncancelled`                           | `UNCANCELLATION`                                  | ✅ 해지 취소              | 파랑 | 다음 갱신             |
| `product_change_scheduled`              | `PRODUCT_CHANGE`                                  | 🔀 상품 변경 예약         | 파랑 | 변경 적용 (다음 갱신) |
| `transferred`                           | `TRANSFER`                                        | 🔁 구독 이전              | 파랑 | 기간 끝               |
| `extended`                              | `SUBSCRIPTION_EXTENDED`                           | ⏳ 구독 연장              | 파랑 | 다음 갱신             |
| `cancellation_scheduled`                | `CANCELLATION`                                    | 🚪 해지 예약              | 노랑 | 이용 종료             |
| `trial_cancelled`                       | 체험 중 `CANCELLATION`                            | ⏸️ 체험 해지 예약         | 노랑 | 체험 끝               |
| `billing_issue`                         | `BILLING_ISSUE`                                   | ⚠️ 결제 문제              | 빨강 | 기간 끝               |
| `refunded`                              | `CANCELLATION` + `cancel_reason=CUSTOMER_SUPPORT` | 💸 환불                   | 빨강 | 원래 기간 끝          |
| `expired`                               | `EXPIRATION`                                      | ⌛ 구독 만료              | 빨강 | 만료 시각             |
| `trial_expired`                         | 체험 중 `EXPIRATION`                              | 📉 체험 종료 (전환 안 됨) | 빨강 | 만료 시각             |

이벤트 분류는 환불 → 체험 단계(billing `classifySubscriptionLifecycle`) → 일회성 구매 → 이벤트 종류 순이다(`subscriptionNoticeEventOf`).

사용자 블록 다음 줄은 국가·프리미엄·공급자 링크, 그 뒤가 결제 블록이다.

| 필드           | 값                                                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 국가           | `country_code`를 국기·한국어 국가명·코드로 (`🇰🇷 대한민국 (KR)`)                                                                        |
| 프리미엄       | 이벤트를 반영한 뒤의 출처: `스토어 구독 (체험 중)` / `스토어 구독 · 초대 보상 7일 대기` / `초대 보상 · 5일 남음 · 이어서 3일` / `무료` |
| RevenueCat     | 고객 화면 링크(`REVENUECAT_PROJECT_ID`가 있을 때). embed 제목 링크와 같다                                                              |
| 요금제         | 연간 / 월간 (`planType`, 상품 ID로 정함)                                                                                               |
| 상품           | 상품 ID                                                                                                                                |
| 스토어         | App Store / Google Play / Stripe 등                                                                                                    |
| 금액           | 현지 통화와 USD 환산을 웹훅 값 그대로 (`₩39,000 · US$27.99`, 환불은 음수)                                                              |
| 기간 유형      | 일반 / 무료 체험 / 첫 구매 할인 / 프로모션 / 선불 (`period_type`)                                                                      |
| 환경           | 운영 / 🧪 샌드박스 (테스트 결제 · 매출 아님)                                                                                           |
| (기간 끝)      | `expiration_at_ms`를 KST로 + Discord 상대 시각 (`2027-11-10 09:59 KST · 1년 후`). 칸 이름은 위 표                                      |
| 구매 시각      | `purchased_at_ms`(구매·갱신)를 KST로                                                                                                   |
| 결제 재시도 끝 | 결제 문제만. `grace_period_expiration_at_ms`                                                                                           |
| 첫 구매        | 새 구독만. 이 사용자의 첫 스토어 구매인지                                                                                              |
| 사유           | 해지·만료·환불. `cancel_reason`/`expiration_reason`을 사람 말 + 원문 코드로 (`결제 실패 (BILLING_ERROR)`). 사유가 없으면 `—`           |
| 바뀔 상품      | 상품 변경 예약만. `new_product_id`와 그 요금제                                                                                         |
| 이전           | 이전만. `transferred_from` → `transferred_to` (셋까지, 나머지는 개수)                                                                  |
| 앱·기기        | 구독자 속성 `appVersion`·`deviceModel`                                                                                                 |
| 원거래 ID      | `original_transaction_id`. 20자를 넘으면 앞 8자…뒤 6자                                                                                 |

사유 라벨: `UNSUBSCRIBE` 사용자가 해지 · `BILLING_ERROR` 결제 실패 · `DEVELOPER_INITIATED` 개발자가 취소 · `PRICE_INCREASE` 가격 인상에 동의하지 않음 · `CUSTOMER_SUPPORT` 스토어 고객지원 환불 · `SUBSCRIPTION_PAUSED` 구독 일시정지 · `UNKNOWN` 알 수 없음. RevenueCat 원문 → billing 어휘는 ACL(`revenuecat-webhook-translator.adapter.ts`), billing 어휘 → 사람 말은 Discord 어댑터가 바꾼다.

웹훅 값은 billing이 `SubscriptionEventPayload`에 이벤트 종류와 상관없이 같은 이름으로 싣는다(`baseEventPayload`). 체험 시작처럼 금액이 0이면 0을 그대로 보인다.

### 웹훅 처리 실패 (권고)

웹훅 처리 실패(`SUBSCRIPTION_1602` 등)는 이 알림이 아니라 운영 경보 `billing.subscription.webhook.processing-failed`(Sentry)다. Sentry 알림 규칙으로 결제 채널에 보낼 때는 메시지에 태그 `storeEnvironment`(SANDBOX/PRODUCTION)·`eventKind`·`store`와 details의 `errorCode`·`eventId`·`productId`를 보이게 하고, 제목 앞에 `🚨`를 붙여 이 알림의 빨강(결제 문제·환불·만료)과 구분하기를 권한다. 사용자 이메일·닉네임은 Sentry에 싣지 않으므로 사용자는 RevenueCat 고객 화면이나 내부 사용자 ID로 찾는다.

## 운영 채널 알림

| 알림           | 트리거                                                                                              | 제목                           |
| -------------- | --------------------------------------------------------------------------------------------------- | ------------------------------ |
| 회원가입       | 신규 가입                                                                                           | 👋 새로운 회원가입             |
| 일일 가입 요약 | 매일 KST 기준 전일 집계                                                                             | 일일 가입 리포트 \| YYYY-MM-DD |
| (알림 없음)    | 로그인. 로그인마다 보내면 소음이 커서 보내지 않는다                                                 | -                              |
| (알림 없음)    | RevenueCat 웹훅 실패는 운영 경보(`billing.subscription.webhook.processing-failed`, Sentry)로 올린다 | -                              |

### 회원가입 알림

본문은 `**{닉네임}** 님이 가입했습니다.`이고, 닉네임이 없으면 이메일 앞부분을 쓴다. 사용자 블록(결제 알림과 같음) 뒤에 가입 요청의 정보를 둔다. 값이 없으면 `—`다.

| 필드        | 값                                                                                             |
| ----------- | ---------------------------------------------------------------------------------------------- |
| 기기        | 플랫폼(🍎 iOS / 🤖 Android / 🌐 Web) + OS 버전 · 기기 모델 (예: `🍎 iOS 18.1 · iPhone 16 Pro`) |
| 앱 버전     | `v{X-App-Version} ({X-App-Build})`, 빌드 번호가 없으면 `v{버전}`                               |
| 언어·시간대 | Accept-Language 첫 언어 태그 · X-Timezone (예: `ko · Asia/Seoul`)                              |

기기·앱 정보는 앱이 보낸 요청의 헤더(`X-Device-Type`, `X-Device-Name`, `X-OS-Version`, `X-App-Version`, `X-App-Build`, `Accept-Language`, `X-Timezone`)를 `resolveRequestDevice`가 형식·길이 검증한 값으로, 표시용이며 신뢰 판단에 쓰지 않는다. `X-Device-Type`이 없으면 User-Agent에서 모바일 플랫폼만 추정한다. 앱 버전별로 보내는 헤더가 달라서 1.14.0 이하 앱은 `X-OS-Version`·`X-App-Build`가 없어 OS 버전과 빌드 번호 없이 표시되고(1.13.0 이하는 기기 모델도 없어 User-Agent로 확인한 플랫폼만 표시), 확인되지 않은 필드는 `—`로 둔다. 국가·초대 경로는 가입 요청에서 확인할 수 없어 표시하지 않는다.

알림을 보내는 자리는 그 요청을 앱이 보냈는지로 정한다.

| 가입 경로                                         | 계정 생성                   | 알림                                               |
| ------------------------------------------------- | --------------------------- | -------------------------------------------------- |
| 이메일                                            | `POST /v1/auth/register`    | 같은 요청(`Register`)                              |
| 네이티브 콜백 `POST /v1/auth/{provider}/callback` | 같은 요청                   | 같은 요청(`LoginWithMobileOAuthToken`)             |
| 웹 흐름 `GET /v1/auth/{provider}/web-callback`    | 시스템 브라우저의 콜백 요청 | 앱의 `POST /v1/auth/exchange`(`ExchangeOAuthCode`) |

웹 콜백에는 앱 헤더가 없어서 교환 요청까지 알림을 미룬다. 교환 코드는 일회용이라 알림도 한 번만 나가고, 가입 시각은 저장된 `User.createdAt`이다. 코드를 받기 전에 앱을 떠나면(10분 안에 교환하지 않으면) 그 가입의 즉시 알림은 나가지 않는다. 일일 가입 요약은 DB의 `Account.createdAt`으로 세므로 이 가입도 숫자에 들어간다. 조회나 큐 등록이 실패해도 로그인은 끝까지 진행하고 `identity.user.signup-notification.failed` 또는 `operations` 등록 실패 로그만 남긴다.
