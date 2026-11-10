---
'@aido/api': patch
'@aido/server': patch
---

날씨 v2(`GET /v2/weather`) 응답에 선택 필드 `briefing`(`reason`·`affectedTodoIds`·`rescheduleOptions`)을 더해 비·더위에 영향받는 오늘 남은 할 일과 옮길 시각 후보를 서버가 고른다. 할 일을 읽지 못하면 `briefing`만 빠지고 리포트는 그대로 응답한다.
