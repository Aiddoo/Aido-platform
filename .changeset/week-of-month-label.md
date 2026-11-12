---
'@aido/server': patch
---

주간 리포트의 `periodLabel`을 주간 성취 `weekLabel`과 같은 "11월 2주차"/"Week 2 of Nov"(주의 목요일이 속한 달의 몇째 주)로 만든다. 주차 달의 해가 사용자 저장 시간대의 올해가 아니면 연도를 붙인다("2025년 12월 1주차"/"Week 1 of Dec 2025"). 두 라벨은 `shared/domain/time/week-of-month.ts`의 `formatIsoWeekLabel` 하나에서 나오고 앱과 같은 표(`packages/api/test/fixtures/week-of-month-cases.json`)로 테스트한다. 응답 모양은 그대로(문자열)다. 주간 성취 라벨은 올해 주가 그대로이고 다른 해 주만 연도가 붙는다. 월간 라벨("2026년 3월")도 그대로다.
