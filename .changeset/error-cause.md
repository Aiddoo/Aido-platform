---
'@aido/server': patch
---

`ApplicationException`·`DomainException`이 감싼 원본 오류를 `cause`로 받는다(세 번째 인자 `{ message?, cause? }`). AI 생성 실패(`AI_1301`·`AI_1302`·`AI_1310`), 날씨 리포트 공급자 실패(`WEATHER_1901`), 사용자 태그 충돌(`SYS_0001`)이 원본을 넘겨 Sentry에서 원인 오류가 이어진다. 응답의 코드·상태·문구·details는 그대로다.
