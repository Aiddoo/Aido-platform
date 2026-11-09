---
'@aido/api': minor
'@aido/server': minor
---

연간으로 자동 갱신될 구독에 결제 7일 전 기간마다 한 번 알린다(서버 전용 `PREMIUM_RENEWAL_UPCOMING`, 앱에는 `SYSTEM_NOTICE`와 구독 화면 경로). 월간·모르는 상품은 보내지 않고, Play에서 요금제를 바꿔 남은 옛 체인에도 보내지 않는다. `Subscription.renewalNoticeExpiresAt`에 알린 기간의 만료를 남겨 갱신으로 기간이 바뀌면 다음 기간에 다시 보낸다. RevenueCat `PRODUCT_CHANGE`는 정보성이라 상품·만료·상태를 바꾸지 않고 웹훅 `new_product_id`를 `Subscription.nextProductId`로 예약만 하며, `RENEWAL`·`INITIAL_PURCHASE`가 이벤트 상품을 지금 상품으로 맞춘다(지난 기간 `PRODUCT_CHANGE`가 만료를 앞당겨 쌓아 둔 보상을 시작하던 문제를 고친다). `premium-grant-sweep`의 안내 단계는 한 단계가 실패해도 나머지를 보낸 뒤 잡을 실패로 끝낸다.
