---
'@aido/api': minor
'@aido/server': minor
---

`/me`에 선택 칸 `premiumPlanType`(`ANNUAL`·`MONTHLY`, 모르면 null)을 더한다. 지금 프리미엄 기간을 정하는 스토어 구독의 상품 ID로 정하고 Play의 `상품:기본요금제`는 `:` 앞만 본다. 체험 종료 3일 전 알림의 자동 갱신 문구가 "연간 구독"을 하드코딩하지 않고 요금제로 고르며, 모르는 상품이면 "구독"이라고 쓴다. 어휘 `SUBSCRIPTION_PLAN_TYPES`·`STORE_SUBSCRIPTION_PRODUCTS`·`PREMIUM_RENEWAL_NOTICE_DAYS`를 더했다.
