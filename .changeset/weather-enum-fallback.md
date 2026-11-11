---
'@aido/api': patch
'@aido/server': patch
---

날씨 v2 리포트 응답에서 서버가 앞으로 더할 열거 값을 그 칸만 대체값으로 읽는다(`.catch`). 날씨 상태는 `CLOUDY`, 강수 형태는 `MIXED`(분 단위 구간은 `null`), 기압 추세는 `STEADY`, 달 위상은 `NEW`, 특보 심각도는 `UNKNOWN`, 옮기기 이유는 `null`, 모르는 대기질 출처는 대기질 칸째 `null`이다. 서버가 보내는 값과 필수 칸은 같고 OpenAPI에는 해당 속성의 `default`만 더해진다.
