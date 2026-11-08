---
'@aido/api': minor
'@aido/server': minor
---

서비스·거래 알림을 광고성 동의와 분리한다. 온보딩 D0~D7 사용법 안내는 서비스 알림으로 바꿔 광고성 동의 없이 보내고, 광고성 푸시는 제목 앞 "(광고)"와 본문 끝 수신 거부 방법을 한 곳에서 붙인다. 광고성 수신 동의 2년 재확인 알림을 매월 보내고 `UserConsent.marketingReconfirmedAt`에 남긴다. 광고성 동의 변경 응답에 철회를 처리한 서버 시각(`marketingWithdrawnAt`·`marketingPushWithdrawnAt`)을 더했다. 이메일·소셜 가입이 동의한 약관 버전(`agreedTermsVersion`, 지금까지 늘 null)을 `TERMS_VERSION.CURRENT`로 남긴다. 소셜 가입은 지금처럼 가입 때 약관·개인정보 동의를 기록한다. `pushEnabled`·`nightPushEnabled`의 DB·어휘 기본값을 가입 seed와 같은 true로 맞췄다(기존 행은 그대로).
