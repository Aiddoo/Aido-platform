---
'@aido/api': minor
'@aido/server': minor
---

할 일 개요 `GET /v1/todos/overview`(`getTodoOverview`, `TodoOverviewResponseDto`)를 더한다. 할 일·완료한 할 일·진행 중인 반복이 있는지(`hasTodo`·`hasCompletedTodo`·`hasActiveRepeat`)를 서버가 계산해 한 번에 준다. `hasActiveRepeat`은 진행 중 반복 상한과 같은 기준(다음 회차가 남은 규칙)이고 휴면으로 멈춘 규칙도 센다. 기존 목록·요약 API는 그대로다.
