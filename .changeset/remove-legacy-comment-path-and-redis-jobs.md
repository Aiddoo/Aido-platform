---
'@aido/server': patch
---

1.14.1 전환용으로 남겨 둔 레거시를 지운다. migration `drop_legacy_comment_path_and_retention_outbox`가 `TodoComment.path`·`depth`·`rootId` 열과 `RetentionPushOutbox` 테이블·`RetentionOutboxStatus` enum을 지운다. Redis/BullMQ 작업 runtime, `JOB_BACKEND`·`JOB_REDIS_DRAIN_ENABLED` 설정, `.v1` 없는 이전 이름 queue worker, deprecated `jobKey`, 만료된 이전 캐시 키 삭제도 지운다. REST 계약은 그대로라 배포된 앱에는 영향이 없다. 1.14.1 이하 API 이미지는 지운 열에 쓰므로 이 migration 뒤 이미지만 롤백하면 댓글 작성이 실패한다.
