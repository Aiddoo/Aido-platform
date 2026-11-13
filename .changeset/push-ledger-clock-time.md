---
'@aido/server': patch
---

푸시 발송 원장(`PushDispatch`·`PushDispatchOutbox`·`PushDeliveryAttempt`)의 `updatedAt`·`sentAt`·`publishedAt`·receipt 만료 시각과 stale lease 복구의 `availableAt`을 DB `CURRENT_TIMESTAMP` 대신 서버 `ClockPort` 시각으로 남긴다. outbox·lifecycle 복구, rate limit 예약, 종결 표시, receipt 만료·종결은 Drizzle query builder로 옮기고 claim·finalize·release의 데이터 변경 CTE만 raw SQL로 남긴다. 상태 전이·fence·잠금 순서, 큐 이름과 payload는 그대로다.
