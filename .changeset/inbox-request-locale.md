---
'@aido/server': patch
---

알림함 목록(`GET /v1/notifications`, `GET /v1/notifications/inbox`)이 새로 저장한 알림부터 요청 `Accept-Language`로 문구를 다시 렌더한다. `Notification`에 nullable `copyKey`·`copyFacts` 컬럼을 더하는 추가 마이그레이션이 있고, 옛 알림과 `Accept-Language`가 없는 요청은 저장한 문구를 그대로 쓴다.
