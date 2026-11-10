---
'@aido/server': patch
'@aido/api': patch
---

관리자 브로드캐스트 캠페인(`POST /v2/admin/notifications/broadcasts`)에 선택 필드 `localizedContent`(언어별 제목·본문, 없는 언어는 `title`·`body`)와 `delivery`(`NOW` 기본, `RECIPIENT_LOCAL_TIME`은 수신자 저장 시간대의 날짜·시각, 이미 지났으면 다음 날)를 더하고, 마케팅 분배·발송 작업은 우선순위 0 차선에 올린다. 성장 지표 응답에 `stickiness`(DAU/MAU %)를 더한다. 관리자 API 추가 필드라 출시 앱 계약은 그대로다. `BroadcastCampaign`에 `localizedContent`·`delivery` 컬럼(nullable jsonb)을 더하는 추가 마이그레이션이 있다.
