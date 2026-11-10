---
'@aido/server': patch
---

서버 런타임을 Node 26.13.0 LTS(Docker 기본 이미지·`.nvmrc`)와 NestJS 12.4로 올리고 서버 날짜 계산을 내장 Temporal로 바꾼다. 모바일 EAS 빌드는 Node 24.22.2를 유지한다.
