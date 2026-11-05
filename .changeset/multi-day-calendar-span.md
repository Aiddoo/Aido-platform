---
'@aido/api': minor
'@aido/server': minor
---

일일 완료 조회 응답(`GET /v1/daily-completions`, 친구 조회 포함)에 선택 칸 `multiDayTodos`(시작일·끝 날짜·완료 여부·카테고리 색)를 더한다. `completions`는 출시 앱이 읽던 대로 시작일에만 세고, 새 앱이 달력에서 기간 안의 날에도 점을 그린다.
