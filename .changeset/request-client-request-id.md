---
'@aido/server': patch
---

앱 요청 헤더를 요청마다 한 번 `RequestClient`로 정규화해 컨트롤러·guard·interceptor가 같은 값을 읽는다. 시간대 해석 규칙(UTC 폴백·보낸 값만 사용)을 한 곳의 함수로 모았고 엔드포인트별 동작과 응답 형태는 그대로다. 요청마다 `X-Request-Id`(앱이 보낸 UUID 또는 새 UUID)를 정해 응답 헤더·로그 `reqId`·Sentry `request_id` 태그로 남기고, CORS에서 `X-Request-Id`를 받고 노출하며 쓰지 않던 `X-Requested-With`는 뺀다.
