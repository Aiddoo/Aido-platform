---
'@aido/server': patch
---

pg-boss 연결 풀이 앱 풀과 같은 `createPostgresPoolConfig`로 만들어진다. 이제 pg-boss 연결도 세션 `TimeZone=UTC`, `statement_timeout` 15초·`lock_timeout` 5초·`idle_in_transaction_session_timeout` 60초, 유휴 연결 정리(`DATABASE_POOL_IDLE_TIMEOUT_MS`), URL `sslmode`의 TLS 인증서 검증과 `DATABASE_SSL_ALLOW_UNVERIFIED` 비상 설정을 따른다. 크기 3과 연결 이름 `aido-pg-boss`, 큐 이름·작업 payload는 그대로다.
