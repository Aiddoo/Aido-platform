---
'@aido/api': minor
'@aido/server': minor
---

할 일 시간을 떠 있는 시각으로 바꾼다. `Todo.scheduledLocalTime`(HH:mm)이 진실이고 `scheduledTime`은 날짜 + 벽시계 + 사용자 시간대로 만든 파생값이다. 응답에 선택 칸 `scheduledLocalTime`을 더하고, 저장 시간대가 바뀌면 `todo-timezone-rebase.v1` 작업이 앞으로 할 일과 알림을 현지 시각으로 다시 계산한다. 출시 앱의 옛 경로(`POST /v1/todos/recurring`, 메모 변환의 `isRecurring`, AI 제안 수락)에는 진행 중 반복 300개 상한을 두고 `TODO_0813`으로 거절한다.
