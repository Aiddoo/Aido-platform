# 관리자 알림

운영 채널(가입)과 결제 채널(구독)로 가는 관리자 알림 기준이다. 구현 정본은 `src/modules/operations/application/messages/notifications`다. 알림은 채널에 상관없는 모델(`AdminNotification`: 제목·본문·`severity`·필드·링크)로 만들고, `AdminNotifierPort`의 어댑터가 채널 형식으로 보낸다. 지금 어댑터는 Discord(webhook·embed 렌더링은 `infrastructure/adapters/notifications/discord-embed.renderer.ts`)와 로그(`ADMIN_NOTIFIER_PROVIDER=log`)이며, 다른 채널은 어댑터와 factory 표에 한 줄을 더해 붙인다.

발송은 `admin-notification` 큐 잡으로 처리해 채널 실패가 회원가입·웹훅 처리를 막지 않는다. 일시 실패(429·5xx·연결 실패)만 큐가 2회까지 다시 시도하고, 채널이 거절한 요청(그 밖의 4xx)은 다시 보내지 않고 운영 경보(`operations.admin-notification.rejected`)를 올린다. webhook이 설정되지 않은 채널은 건너뛴다. 큐에 남은 이전 형식 잡(보관 24시간)은 한 릴리스 동안 info 알림으로 바꿔 받는다.

`severity`는 채널 색으로 바뀐다: info 파랑·success 초록·warning 노랑·critical 빨강. 시각 필드는 채널이 보는 사람의 시간대로 보여 준다.

## 결제 알림 카탈로그

RevenueCat 웹훅이 처리 원장에 새로 기록되고 구독 상태가 바뀐 이벤트만 알림을 보낸다. 같은 이벤트 ID의 재전송·중복 처리와 `TEST`·미지원 이벤트는 알림이 없다. 이벤트 ID가 실려 오면 `subscription-event_<eventId>` 잡 ID로 한 번만 큐에 등록한다.

| 이벤트                              | 제목                | 등급     | 추가 필드 |
| ----------------------------------- | ------------------- | -------- | --------- |
| `INITIAL_PURCHASE`                  | 🎉 새로운 구독 구매 | success  | -         |
| `NON_RENEWING_PURCHASE`             | 🛒 일회성 구매      | success  | -         |
| `RENEWAL`                           | 🔄 구독 갱신        | info     | -         |
| `CANCELLATION`                      | ❌ 구독 취소        | critical | 취소 사유 |
| `CANCELLATION` + `CUSTOMER_SUPPORT` | ↩️ 구독 환불        | critical | 취소 사유 |
| `UNCANCELLATION`                    | ✅ 구독 취소 철회   | success  | -         |
| `EXPIRATION`                        | ⏰ 구독 만료        | info     | 만료 사유 |
| `BILLING_ISSUE`                     | ⚠️ 결제 문제 감지   | warning  | -         |
| `PRODUCT_CHANGE`                    | 🔀 구독 상품 변경   | info     | -         |
| `SUBSCRIPTION_EXTENDED`             | ⏳ 구독 연장        | success  | -         |
| `TRANSFER`                          | 🔁 구독 이전        | info     | -         |
| 그 외                               | 📋 구독 이벤트      | info     | -         |
| `environment=SANDBOX` (모든 이벤트) | `[샌드박스]` 접두어 | info     | 환경 표시 |

본문은 `**{이름}** 님의 구독 이벤트 ({RevenueCat 이벤트})`이고, 이름이 없으면 이메일 앞부분을 쓴다.

모든 이벤트가 같은 필드를 같은 순서로 표시하며 값이 없으면 `—`로 둔다.

| 필드      | 값                                                                                  |
| --------- | ----------------------------------------------------------------------------------- |
| 이메일    | 전체 이메일 (회원가입 알림과 동일, 내부 운영 채널)                                  |
| 이름      | 프로필 이름, 없으면 이메일 앞부분                                                   |
| 상품      | 상품 ID에서 읽은 기간(월간/연간/주간) · 상품 ID                                     |
| 스토어    | Apple App Store / Google Play Store / Stripe 등                                     |
| 기기      | 스토어에서 정한 플랫폼(🍎 iOS / 🤖 Android / 🌐 Web) · 기기 모델 · 앱 버전(있을 때) |
| 금액      | 구매 통화 금액(₩29,900), 구매 통화가 USD가 아니면 `(≈ $2.99)` 병기                  |
| 환경      | 운영 / 🧪 샌드박스 (테스트 결제 · 매출 아님)                                        |
| 구독 유형 | 일반 / 무료 체험 / 첫 구매 할인 / 프로모션 / 선불 (`period_type`)                   |
| 자동 갱신 | 이벤트 직후 상태(켜짐 / 꺼짐 / 켜짐 (결제 재시도 중) / 해당 없음 (일회성))          |
| 국가      | 국기 · 국가 코드 (`country_code`)                                                   |
| 구매일    | 시각 필드(채널이 보는 사람의 시간대로 표시, 한국에서는 KST)                         |
| 만료일    | 시각 필드                                                                           |
| 사유      | 취소·만료 이벤트만. 한국어 라벨 + 원문 코드 (예: `사용자 해지 (UNSUBSCRIBE)`)       |
| 트랜잭션  | 20자를 넘으면 앞 8자…뒤 6자                                                         |
| 사용자 ID | 내부 사용자 ID                                                                      |

국가·구독 유형·만료 사유·기기 모델·앱 버전·이벤트 ID는 billing이 구독 이벤트 페이로드에 실어 보낼 때만 표시된다(`SubscriptionAlertInput`). RevenueCat 고객 화면 주소는 알림 링크(`link`)로 싣는다.

## 운영 채널 알림

| 알림           | 트리거                                                                                              | 제목                           |
| -------------- | --------------------------------------------------------------------------------------------------- | ------------------------------ |
| 회원가입       | 신규 가입                                                                                           | 👋 새로운 회원가입             |
| 일일 가입 요약 | 매일 KST 기준 전일 집계                                                                             | 일일 가입 리포트 \| YYYY-MM-DD |
| (알림 없음)    | RevenueCat 웹훅 실패는 운영 경보(`billing.subscription.webhook.processing-failed`, Sentry)로 올린다 | -                              |

### 회원가입 알림

본문은 `**{이름}** 님이 가입했습니다.`이고, 이름이 없으면 이메일 앞부분을 쓴다. 결제 알림처럼 같은 필드를 같은 순서로 표시하며 값이 없으면 `—`로 둔다.

| 필드        | 값                                                                                             |
| ----------- | ---------------------------------------------------------------------------------------------- |
| 이메일      | 전체 이메일                                                                                    |
| 이름        | 프로필 이름, 없으면 이메일 앞부분                                                              |
| 가입 방식   | 이메일 / Apple / Google / Kakao / Naver                                                        |
| 기기        | 플랫폼(🍎 iOS / 🤖 Android / 🌐 Web) + OS 버전 · 기기 모델 (예: `🍎 iOS 18.1 · iPhone 16 Pro`) |
| 앱 버전     | `v{X-App-Version} ({X-App-Build})`, 빌드 번호가 없으면 `v{버전}`                               |
| 언어·시간대 | Accept-Language 첫 언어 태그 · X-Timezone (예: `ko · Asia/Seoul`)                              |
| 사용자 ID   | 내부 사용자 ID                                                                                 |
| 가입 시각   | 시각 필드                                                                                      |

기기·앱 정보는 인증 요청 헤더(`X-Device-Type`, `X-Device-Name`, `X-OS-Version`, `X-App-Version`, `X-App-Build`, `Accept-Language`, `X-Timezone`)를 `resolveRequestDevice`가 형식·길이 검증한 값으로, 표시용이며 신뢰 판단에 쓰지 않는다. `X-Device-Type`이 없으면 User-Agent에서 모바일 플랫폼만 추정한다. 1.13.1 앱은 `X-OS-Version`·`X-App-Build`를 보내지 않아 OS 버전과 빌드 번호 없이 표시되고(1.13.0 이하는 기기 모델도 없어 User-Agent로 확인한 플랫폼만 표시), 웹 OAuth 콜백처럼 앱 헤더가 없는 가입은 확인되지 않은 필드를 `—`로 둔다. 국가·초대 경로는 가입 요청에서 확인할 수 없어 표시하지 않는다.
