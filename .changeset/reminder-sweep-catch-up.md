---
'@aido/server': patch
---

시간대 리마인더 sweep(`tz-reminder-sweep`)이 배포·재시작으로 놓친 분을 마지막으로 끝낸 분부터 최대 15분까지 그 분의 시각으로 차례로 처리한다. 진행 위치를 남기는 `ScheduledSweepCursor` 테이블을 더하는 추가 마이그레이션이 있다.
