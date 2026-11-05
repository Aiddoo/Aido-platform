---
'@aido/api': minor
'@aido/server': minor
---

메모 나누기(`POST /v1/ai/parse-memo`)에 선택 `Idempotency-Key` 헤더를 더해 재시도가 두 번 차감되지 않게 한다. 헤더가 없는 출시 앱은 지금처럼 요청마다 차감한다. 공통 헤더 이름 `IDEMPOTENCY_KEY_HEADER`를 vocabulary에 더한다.
