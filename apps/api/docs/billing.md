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
