---
'@aido/server': patch
---

여러 날에 걸친 할 일을 시작일만이 아니라 기간 안의 모든 날에 센다. 연속 기록, 일간 완료(`totalTodos`·`completedTodos`·`completionRate`·`totalCompleteDays`), 주간 성취가 같은 겹침 규칙을 쓰므로 여러 날 할 일이 있는 사용자의 숫자가 바뀔 수 있다(응답 모양은 그대로이고, `multiDayTodos`는 1.15.0 앱이 두 번 더하지 않게 늘 빈 배열이다).
