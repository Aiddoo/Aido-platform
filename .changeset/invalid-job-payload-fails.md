---
'@aido/server': patch
---

큐 작업을 소비할 때 큐 정의의 payload schema로 검사해 모양이 틀린 작업은 완료 대신 실패(DLQ)로 남긴다(예: 시간대 재계산 작업은 전에는 경고 뒤 완료했다). 큐 이름·job key·옛 payload 모양은 그대로이고, 쓰지 않던 `JOB_POLLING_INTERVAL_SECONDS` env를 지운다.
