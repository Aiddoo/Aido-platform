---
'@aido/api': minor
'@aido/server': patch
---

푸시 data에 kind별 판별 유니온 `navigation`을 더한다. 기존 type·action·context·routing은 구 앱 호환용으로 그대로 싣고, 마케팅 배치 푸시도 단건처럼 `MARKETING` category를 싣는다.
