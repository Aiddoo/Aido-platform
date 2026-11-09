# 구독 결제 처리

RevenueCat 웹훅(`POST /v1/webhooks/revenuecat`)과 보상 기간이 프리미엄을 정하는 규칙은 [유료 기능과 권한](../.claude/architecture.md#유료-기능과-권한)에 있다. 이 문서는 운영 결정만 적는다.

## SANDBOX 결제

- 웹훅의 `environment`(SANDBOX·PRODUCTION)는 구독 행(`Subscription.environment`)과 처리 원장(`SubscriptionEventReceipt.environment`)에 남긴다. 열을 추가하기 전 행은 null(알 수 없음)이다.
- **SANDBOX 구매도 프리미엄을 준다.** App Review는 운영 서버에 sandbox 결제로 구매를 확인하므로 막으면 심사가 거절될 수 있다. TestFlight 테스터도 같은 경로다.
- SANDBOX는 매출이 아니다. 시작·완료 로그(`billing.subscription.webhook.*`)와 운영 알림 payload에 `environment`를 싣고, 알림은 샌드박스임을 표시한다. 현재 서버는 매출·구독자 지표를 계산하지 않으며, 새 지표를 만들면 `environment = 'SANDBOX'` 행을 뺀다.
- 운영 알림의 RevenueCat 고객 링크는 공개 프로젝트 ID `REVENUECAT_PROJECT_ID`가 있을 때만 붙는다.

## 결제 실패와 결제 유예

결제가 실패하면 RevenueCat은 `BILLING_ISSUE`와 `CANCELLATION`(`cancel_reason: BILLING_ERROR`)을 함께 보낸다. App Store·Play가 결제를 다시 시도하는 결제 유예(최대 16·30일) 동안 RevenueCat은 엔타이틀먼트를 유지하므로 서버도 따른다.

| 시점                             | 서버 판단                                                                                                                                 |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `BILLING_ISSUE`                  | `grace_period_expiration_at_ms`를 `Subscription.gracePeriodEndsAt`에 남긴다. null(유예 미사용)이면 바꾸지 않는다. 결제 문제 알림은 그대로 |
| 유예 중(취소 상태 포함)          | 프리미엄. 쌓아 둔 보상은 시작하지 않는다(`/me`의 `premiumPeriodEndsAt`은 유예 끝)                                                         |
| 결제 복구(`RENEWAL`)             | 유예를 지우고 새 만료 시각까지 프리미엄. 보상은 시작한 적이 없어 다시 쌓거나 일수를 올리지 않는다                                         |
| 유예 끝(`EXPIRATION` 또는 sweep) | 쌓아 둔 보상이 유예 끝 시각부터 한 번 시작한다. `EXPIRATION`은 유예를 지우고 만료 시각을 유예가 실제로 끝난 시각으로 남긴다               |

TS 판단(Billing `isStoreEntitlementValid`, Access `resolvePremiumAccessDeadline`)과 SQL(`validStoreEntitlementCondition`)은 같은 규칙(`storeEntitlementEndsAt`)을 쓴다.

## 끊은 보상 기간

스토어가 유효해지는 동안 진행 중이던 보상은 그 시각에 끝내고 남은 길이를 ms 그대로(`PremiumGrant.durationMs`) 다시 쌓는다. 표시 일수(`durationDays`·`bankedDays`)만 올림하므로 같은 기간을 여러 번 끊어도 기간이 늘거나 줄지 않는다.

## TRANSFER

RevenueCat `TRANSFER`에는 `app_user_id`·`product_id`가 없고 `transferred_from`·`transferred_to`만 온다. 전용 스키마(`revenueCatTransferWebhookPayloadSchema`)로 받고, 다른 이벤트는 기존 스키마로 그대로 엄격하게 검증한다. `transferred_to` 중 우리 사용자로 매핑되는 첫 값(User.id 또는 `revenueCatUserId`)이 받은 사용자다. 넘겨준 사용자의 행을 옮긴 뒤 두 사용자를 id 순으로 잠가 함께 다시 계산하고 캐시를 비운다. 형식이 틀린 웹훅은 `billing.subscription.webhook.invalid`(`eventType`·`issueCount`)로 남는다.

## 행이 없는 체인의 갱신

탈퇴(hard delete)로 `Subscription` 행이 함께 지워진 계정의 구매를 새 계정이 복원하면 `TRANSFER`로 옮길 행이 없다(RevenueCat `TRANSFER` payload에는 상품·만료 시각이 없다). 그 체인의 `RENEWAL`이 오면 payload(상품·만료·구매 시각·환경·원 거래 ID)로 행을 만들고 다시 계산한다(`billing.subscription.chain.adopted`). 다음 갱신 전까지는 복원한 계정이 프리미엄이 아니다.

## 만료 웹훅을 잃었을 때

`premium-grant-sweep`(10분 주기)이 User projection은 ACTIVE인데 Access 판단으로 끝난 사용자(스토어 엔타이틀먼트(자동 갱신 유예 3시간·결제 유예 포함)가 끝났고 진행 중인 보상이 없음)를 500명씩 다시 계산해 FREE(또는 이어지는 보상 기간)로 저장하고 캐시를 비운다(`billing.premium-access.lapsed.swept`). 정리 전에도 권한·스케줄러 판단은 만료를 반영한다.

## 보상 취소

`RevokePremiumGrant`(출처 키 기준)는 기간을 지우지 않고 REVOKED로 남기며, 진행 중이면 지금 끝내고 다시 쌓아 둔 남은 기간도 함께 취소한다. 공개·관리자 HTTP 경로는 없고 운영 작업에서 UseCase로 호출한다.

## 상품 변경

RevenueCat `PRODUCT_CHANGE`는 정보성 안내다. `product_id`는 바꾸기 전 상품, `new_product_id`는 바꾼 대상이고 `expiration_at_ms`는 바꾸기 전 상품의 만료다. 실제 적용 신호는 App Store·Stripe가 `RENEWAL`, Google Play가 `INITIAL_PURCHASE`(새 체인)다([이벤트 필드](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields), [구독 관리](https://www.revenuecat.com/docs/subscription-guidance/managing-subscriptions)). 그래서 서버는 `PRODUCT_CHANGE`에서 상품·만료·상태를 바꾸지 않고 `Subscription.nextProductId = new_product_id ?? null`만 남기고(갱신 뒤 늦게 온 지난 기간의 안내는 무시), `RENEWAL`·`INITIAL_PURCHASE`가 `productId`를 이벤트 상품으로 맞추고 `nextProductId`를 비운다. `/me`의 `premiumPlanType`은 지금 기간 상품(`planType()`), 연간 갱신 안내는 다음 결제 상품(`renewingPlanType()` = `nextProductId ?? productId`)으로 판단한다.

## 웹훅 뒤 스토어 상태 대조

RevenueCat은 웹훅을 받은 뒤 REST API로 구독자 상태를 다시 읽기를 권한다([웹훅](https://www.revenuecat.com/docs/integrations/webhooks): "we recommend calling the GET /subscribers REST API endpoint after receiving any webhook"). 서버는 웹훅을 신호로 보고, 처리 원장에 새로 기록된 이벤트마다 같은 트랜잭션에 `store-subscription-reconcile.v1` 잡을 넣는다. 1분 구간마다 사용자당 잡 하나로 묶고(idempotency key `store-subscription-reconcile_<userId>_<구간 시작>`, 구간이 끝난 뒤 시작), 재시도 3회·backoff·만료 5분이다.

`ReconcileStoreSubscriptions`는 사용자의 ACTIVE·CANCELLED 체인 행을 스토어 상태로 맞춘다. 스토어 읽기는 트랜잭션 밖에서 하고, 실패하면 아무것도 바꾸지 않고 던져 잡이 다시 시도한다. 재시도가 끝나면 운영 경보 `billing.subscription.reconcile.failed`를 올린다.

| 스토어 상태                     | 우리 행                                                                                             |
| ------------------------------- | --------------------------------------------------------------------------------------------------- |
| 접근 없음(`gives_access=false`) | 아직 엔타이틀먼트를 주는 행을 지금 끝낸다(EXPIRED). 놓친 환불·만료, Play 요금제 교체로 남은 옛 체인 |
| 접근 있음                       | 만료(`current_period_ends_at`)·자동 갱신(ACTIVE/CANCELLED)·체험 여부·상품을 스토어 값으로 맞춘다    |
| 스토어가 모르는 체인            | 바꾸지 않는다                                                                                       |

바뀐 칸이 있을 때만 프리미엄을 다시 계산하고 캐시를 비우며 `billing.subscription.reconcile.corrected`(`userId`·`correctedCount`·`fields`)를 남긴다. 같으면 `…unchanged`다. 대조 결과는 Discord로 보내지 않는다. 결제 채널은 RevenueCat 이벤트 카탈로그만 다루고, 고침은 사람이 손댈 일이 없으며 반복 실패만 운영 경보로 올린다.

API는 REST v2 [구독 검색](https://www.revenuecat.com/docs/api-v2/subscription)(`GET /projects/{project_id}/subscriptions?store_subscription_identifier=`)을 쓴다. 이 검색은 App Store 체인의 어떤 거래 ID나 Play의 어떤 주문 ID도 받으므로, 우리 체인 키 `Subscription.storeSubscriptionId`(DB 칼럼 `revenueCatId`, 웹훅의 `original_transaction_id`)로 행과 1:1로 맞는다. 응답의 [Subscription](https://www.revenuecat.com/docs/api-v2/subscription-data-model)은 `gives_access`·`auto_renewal_status`·`status`(`trialing` 등)·`current_period_ends_at`을 주므로 교체된 Play 체인·환불·체험을 웹훅 없이 판별한다. 상품 ID는 RevenueCat 내부 ID라 [상품 조회](https://www.revenuecat.com/docs/api-v2/product)의 `store_identifier`(Play는 `상품:기본요금제`)로 바꾸고 프로세스 안에서 한 번만 읽는다.

- 고객 단위 목록(`/customers/{id}/subscriptions`)은 `store_subscription_identifier`가 최신 거래·주문 ID라 우리 행과 바로 맞지 않아 쓰지 않는다.
- v1 `GET /subscribers`는 상품 ID로 묶여 같은 상품의 여러 체인을 구분하지 못하고, 없는 고객을 만드는 부작용이 있어 쓰지 않는다.
- 레이트 리밋([API v2](https://www.revenuecat.com/docs/api-v2)): Customer Information 480회/분, Project Configuration 60회/분. 대조는 체인마다 한 번, 상품은 프로세스당 한 번이다. 호출은 `revenuecat` 외부 호출 정책(bulkhead 2, 연속 5회 공급자 장애에 회로) 안에서 하고 재시도는 pg-boss 한 층이다.
- 설정: `REVENUECAT_API_V2_SECRET_KEY`와 `REVENUECAT_PROJECT_ID`가 모두 있어야 켜진다. 없으면 시작할 때 `billing.subscription.reconcile.disabled`를 한 번 남기고 잡을 넣지 않는다(기존 웹훅 처리만). 키는 RevenueCat 대시보드 Project settings → API keys에서 **V2**로 만들고 권한은 읽기 둘(`customer_information:subscriptions:read`, `project_configuration:products:read`)만 준다. v1 키는 v2에서 동작하지 않는다.
- Google Play는 요금제를 바꾸면 새 구매 토큰(새 체인)이 생기고 옛 토큰은 `linkedPurchaseToken`으로 무효화해야 한다([Play 구독](https://developer.android.com/google/play/billing/subscriptions)). 옛 체인의 EXPIRATION은 만료 시각이 저장값보다 일러 무시되지만, 대조가 스토어의 `gives_access=false`를 보고 옛 체인을 끝낸다.

## 공급자 경계

RevenueCat이 보내는 모양은 `infrastructure/revenuecat`에만 있다. 웹훅 원문은 `translateRevenueCatWebhook`이 검증해 공급자를 모르는 `StoreSubscriptionEvent`(kind: `STARTED`·`RENEWED`·`CANCELLED`·`REFUNDED`·`UNCANCELLED`·`EXPIRED`·`BILLING_ISSUE`·`PRODUCT_CHANGE_SCHEDULED`·`EXTENDED`·`TRANSFERRED`·`IGNORED`)로 바꾸고, `ApplyStoreSubscriptionEvent`가 구독 행과 프리미엄에 반영한다. 환불(`CANCELLATION` + `CUSTOMER_SUPPORT`)·`RC_BILLING`→`WEB_BILLING`·빠진 시각(0)·원 거래 ID 대체 같은 공급자 규칙은 번역기 한 곳이다. 같은 폴더에 서명 Guard와 상태 대조 REST 어댑터가 있다. 웹훅 경로·응답·DB 칼럼 `revenueCatId`·`@aido/api`의 웹훅 스키마는 운영 계약이라 그대로 둔다.

두 번째 공급자(예: 토스 웹 정기결제)를 붙일 때는 그 공급자의 번역기·컨트롤러가 같은 `StoreSubscriptionEvent`를 만들면 도메인·`/me`·알림은 그대로다. `SUBSCRIPTION_PROVIDERS`에 값을 더하고, 행마다 공급자를 저장해야 하면 그때 칼럼을 추가한다. 스토어가 갱신을 대신해 주지 않는 정기결제는 결제를 우리가 일으키므로 `RecurringPaymentGateway` 포트(빌링키 결제·취소)와 자체 갱신 스케줄러가 필요하고, 결제 결과를 같은 이벤트(`RENEWED`·`BILLING_ISSUE`·`EXPIRED`)로 넣는다. 공급자가 둘이 되어 고르는 규칙이 생기기 전에는 레지스트리·전략을 만들지 않는다.
