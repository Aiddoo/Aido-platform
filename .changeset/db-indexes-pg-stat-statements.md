---
'@aido/server': patch
---

추가 마이그레이션 `db_performance`가 FK 인덱스 2개(`PushDeliveryAttempt.pushTokenId`, `TodoComment.replyToCommentId`)와 `pg_stat_statements` 확장을 만들고 DB 기본 `timezone`을 UTC로 둔다. 코드에서 쓰지 않는 컬럼·테이블은 롤백 호환을 위해 1.15.1에 남기고 1.15.2에서 지운다.
