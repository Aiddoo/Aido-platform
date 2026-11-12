---
'@aido/server': patch
---

마이그레이션 `drop_push_daily_budget`이 1.15.1·1.15.2 어느 코드도 쿼리하지 않는 `PushDailyBudget` 테이블을 지운다. 행이 하나라도 있으면 지우지 않고 migrate 전체를 되돌린다(API는 바뀌지 않는다). FK 때문에 `User`를 잠깐 배타 잠금하므로 잠금 대기를 0.5초로 줄여 앱 요청이 밀리지 않게 한다. `User.twoFactorEnabled`·`twoFactorSecret`, `Subscription.dataRetentionUntil`은 1.15.1 이미지가 아직 이름으로 읽고 써서 이번에는 스키마에서만 빼고(`retire_unused_columns`, 실행 SQL 없음) DB 칸은 1.16.0에 값이 비었는지 확인한 뒤 지운다. 1.15.1 CHANGELOG의 "1.15.2에서 지운다" 가운데 이 셋은 1.16.0으로 미룬 것이다. `RetentionExperimentAssignment.assignedAt`은 다른 칸에 없는 배정 시각이라 지우지 않는다. 응답 모양과 출시 계약 지문은 그대로다.
