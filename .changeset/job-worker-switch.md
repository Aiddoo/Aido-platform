---
'@aido/server': patch
---

작업 worker를 끄는 `JOB_WORKER_ENABLED`와 pg-boss 풀 `JOB_POOL_MAX`를 더하고, 알림 중복 방지 잠금을 Postgres 트랜잭션 잠금으로 옮긴다.
