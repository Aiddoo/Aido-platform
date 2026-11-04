---
'@aido/server': minor
---

매일 03:10 KST pg-boss 작업 `todo-series-materialization.v1`이 진행 중 반복 할 일의 회차를 앞으로 90일까지 채운다. 규칙당 트랜잭션(`FOR UPDATE SKIP LOCKED` → 정렬 잠금 → INSERT 한 번 → 커서 갱신)이고, 재실행·동시 실행은 `(seriesId, occurrenceDate)` 유니크로 멱등이다. 부팅 때 놓친 실행을 실행일 키로 따라잡고, 정지·탈퇴 대기 계정은 건너뛰며, 실패하거나 4분 상한을 넘으면 운영 경보를 올린다.
