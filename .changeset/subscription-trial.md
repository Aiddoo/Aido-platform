---
'@aido/api': minor
'@aido/server': minor
---

스토어 무료 체험을 저장하고 끝나기 3일 전에 한 번 알린다. RevenueCat 웹훅의 `period_type`을 `Subscription.periodType`에 남기고(`INITIAL_PURCHASE`·`RENEWAL`, 전환 갱신은 `NORMAL`), 체험 단계(시작·해지·전환·종료)는 billing 정책 하나가 판단한다. 계약은 추가만 했다: 웹훅 `is_trial_conversion`·`expiration_reason`, `/me`의 `premiumIsTrial`, 어휘 `STORE_PERIOD_TYPES`·`PREMIUM_TRIAL_ENDING_NOTICE_DAYS`. 체험 끝은 스토어 `expiration_at_ms` 그대로이고 체험 중 받은 초대 보상은 체험 뒤에 이어진다. 안내 알림 `PREMIUM_TRIAL_ENDING`은 서버 전용 타입이라 앱에는 `SYSTEM_NOTICE`와 구독 화면 경로로 보내며 기존 `premium-grant-sweep` 잡에 붙였다. 보상 종료 알림 `PREMIUM_GRANT_ENDING`은 거래 알림으로 바꿔 광고성 동의 없이 보낸다. 관리자 결제 알림은 체험 시작을 ₩0 구매 대신 "무료 체험 시작"과 체험 끝 날짜로 보여 준다. 전환 뒤 늦게 온 체험 해지와 지난 기간의 늦은 갱신은 상태를 되돌리지 않는다.
