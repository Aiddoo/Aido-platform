# @aido/server

## 1.1.0

### Minor Changes

- b263f12: 가입·결제 Discord 알림에 기기·OS·앱 버전·빌드, 스토어·금액·환경을 담는다. 값을 보내지 않는 구 앱은 "—"로 표시한다.
- b4aa0e6: 유료 기능을 `PREMIUM_FEATURES` 카탈로그와 FREE/PREMIUM/ADMIN 접근 단계로 판단한다. 인증 응답에 `isPremium`·`entitlements`(선택 필드)를 더하고, 스토어 결제 유예·환불·TRANSFER와 친구 초대 보상 기간을 같은 권한으로 처리한다.
- a0e0ff8: 1.14.0 앱을 위한 날씨 v2(`/v2/weather`, WeatherKit)를 추가하고, 모든 REST 계약과 컨트롤러를 `v1/` 폴더로 정리한다. 기존 `/v1` 경로와 응답은 그대로다.

### Patch Changes

- a197862: pg-boss 종료 중 작업 등록, 메모리 락, Discord·OAuth 호출 시간 제한, WeatherKit 장애 회로와 리포트 폴백을 정리한다.
- Updated dependencies [b4aa0e6]
- Updated dependencies [a0e0ff8]
  - @aido/api@1.1.0
