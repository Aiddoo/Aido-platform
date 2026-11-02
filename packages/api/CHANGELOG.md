# @aido/api

## 1.1.0

### Minor Changes

- b4aa0e6: 유료 기능을 `PREMIUM_FEATURES` 카탈로그와 FREE/PREMIUM/ADMIN 접근 단계로 판단한다. 인증 응답에 `isPremium`·`entitlements`(선택 필드)를 더하고, 스토어 결제 유예·환불·TRANSFER와 친구 초대 보상 기간을 같은 권한으로 처리한다.
- a0e0ff8: 1.14.0 앱을 위한 날씨 v2(`/v2/weather`, WeatherKit)를 추가하고, 모든 REST 계약과 컨트롤러를 `v1/` 폴더로 정리한다. 기존 `/v1` 경로와 응답은 그대로다.
