---
'@aido/api': minor
'@aido/server': minor
---

`POST /v1/todos`가 선택 필드 `repeat`로 반복 할 일을 만든다. 규칙을 저장하고 앞으로 90일 치 회차를 실제 행으로 만들며, 응답 `todo`는 첫 회차, 새 선택 필드 `series`는 규칙이다(`todoSeriesResponseSchema`). 진행 중 반복은 등급과 상관없이 30개까지(`TODO_0842`), 카테고리 한도는 진행 중 규칙 1개당 1로 센다. `POST /v1/todos/recurring`은 지원 마지막 앱 1.14.x의 호환 경로로 남아 같은 경로를 쓰고, 이전에 `TODO_0812`로 거절하던 긴 범위도 성공한다. 메모 변환 요청에 선택 `repeat`, AI 파싱 응답에 선택 `repeat`를 더하고 출시 앱용 `recurrence`는 그대로 둔다. 회차 리마인더는 커밋 뒤 일괄 등록한다. 추가한 필드는 모두 optional이며 생략 시 동작은 같고, 출시 앱 지문은 `preTodoRepeatSchemasFingerprint`에 이전 값과 사유를 남겼다.
