---
'@aido/api': minor
'@aido/server': minor
---

반복 할 일의 기반을 더한다. `TodoSeries` 테이블과 `Todo.occurrenceDate`, `(recurrenceGroupId, occurrenceDate)` 부분 유니크 인덱스를 만들고 기존 묶음을 끝난 규칙으로 이관한다(같은 날짜 중복은 최소 id만 남기고 묶음 해제). 서버 코드 이름은 `seriesId`이고 DB 열과 응답 필드 `recurrenceGroupId`는 출시 앱·1.14.2 롤백 호환을 위해 그대로 둔다. 공유 계약에 `todoRepeatSchema`·`TodoRepeat`와 `TODO_REPEAT_FREQUENCIES`·`TODO_REPEAT_INTERVALS`·`TODO_REPEAT_END_TYPES`·`TODO_EDIT_SCOPES`를 더한다.
