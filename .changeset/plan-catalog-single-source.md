---
'@aido/api': minor
'@aido/server': minor
---

플랜·한도 숫자를 `PLAN_CATALOG` 한 곳으로 모으고(출시 앱용 `PREMIUM_FEATURES`는 그 부분집합), 무료 AI 정리를 월 10회로 늘리며 프리미엄에는 공정 사용 상한(월 1,000회)을 둔다. 무료·프리미엄 판단은 서버 `hasPaidAccess` 하나로 tier·`isPremium`·SQL 조건이 함께 따른다.
