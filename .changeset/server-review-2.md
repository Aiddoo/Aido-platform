---
'@aido/api': minor
'@aido/server': minor
---

1.15.0 서버 리뷰 수정. 리마인더 재예약이 실제로 등록되도록 작업을 지우고 다시 넣으며 회차 알림을 행과 함께 커밋한다. 할 일 PATCH를 한 트랜잭션(`EditTodo`)으로 묶고, 유효한 유료 사용자의 반복 알림은 멈추지 않으며 무료 사용자에겐 멈출 때 한 번 안내한다. 분할된 규칙을 `TodoSeries.originSeriesId`로 묶어 전체 삭제가 앞 구간까지 지우고 `TodoSeries.sortOrder`를 지운다. 새 반복의 지난 회차는 366개까지다(넘으면 `TODO_0845`, `field: "startDate"`). 결과를 잃은 같은 `Idempotency-Key`는 추가 차감 없이 다시 만들어 200으로 답하고 `AI_1317`을 더 내지 않는다. 앱이 연결을 끊으면 AI 호출을 멈추고 환불한다.
