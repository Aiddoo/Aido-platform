---
'@aido/api': minor
'@aido/server': minor
---

관리자 브로드캐스트를 비동기 캠페인으로 접수하는 `POST /v2/admin/notifications/broadcasts`(202, 요청 ID 멱등)와 분배·발송·전달 결과를 집계하는 `GET /v2/admin/notifications/broadcasts/{campaignId}`를 더한다. 오류 코드 `ADMIN_1404`·`ADMIN_1405`와 `BROADCAST_CAMPAIGN_STATUS`를 추가한다. v1 broadcast는 같은 캠페인으로 접수하는 deprecated 경로가 된다.
