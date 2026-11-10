---
'@aido/server': patch
---

DB 연결에 `application_name=aido-api`와 세션 제한(statement 15초, lock 5초, idle in transaction 60초)을 두고, 풀 연결 대기 기본값을 5초로 한다(`DATABASE_POOL_CONNECTION_TIMEOUT_MS`, 0이면 무제한). DB가 아예 답하지 않을 때를 위해 클라이언트 쿼리 상한 20초를 앱 풀과 pg-boss 풀에 함께 두고, 유휴 연결이 끊겨도 프로세스가 죽지 않는다. 15초를 넘을 수 있는 배치 작업은 자기 트랜잭션에서만 시간 제한을 늘린다.
