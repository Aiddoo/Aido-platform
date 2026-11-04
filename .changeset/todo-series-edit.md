---
'@aido/api': minor
'@aido/server': minor
---

반복 할 일의 범위 수정·삭제와 반복 끝내기를 더한다. `PATCH /v1/todos/:id`에 선택 `scope`(`THIS_ONLY`·`THIS_AND_FOLLOWING`), `repeat`(생략은 변경 없음, null은 이 회차 뒤로 끝내기, 값은 단일 할 일 전환 또는 규칙 변경), `checklist`, `DELETE /v1/todos/:id`에 선택 `scope`(`THIS_ONLY`·`THIS_AND_FOLLOWING`·`ALL`), 새 `GET /v1/todo-series/:seriesId`를 연다. 규칙·체크리스트를 바꾸면 이 회차부터 나누되 맞는 회차의 id·댓글을 유지하고, 완료한 회차의 내용은 바꾸지 않으며(`ALL` 삭제만 지움), 첫 회차에서 고치면 나누지 않는다. 시간을 바꾸면 회차 날짜마다 규칙 시간대로 다시 계산해 리마인더를 재등록한다. 모든 필드는 optional이고 생략하면 동작이 같다. 출시 앱 지문은 `preTodoSeriesScope…Fingerprint`에 이전 값과 사유를 남겼다.
