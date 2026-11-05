---
'@aido/api': minor
'@aido/server': minor
---

메모 나누기(`parse-memo`)도 빠른 계획·녹음 정리처럼 다가오는 할 일을 맥락으로 받아 겹침을 판정한다. 응답 할 일에 선택 칸 `duplicateOfTodoId`를 더하고, 모델이 못 고른 겹침은 같은 정책(`findDuplicateTodoId`)이 제목과 날짜로 다시 찾는다. 출시 앱은 새 칸을 버리므로 동작이 같다.
