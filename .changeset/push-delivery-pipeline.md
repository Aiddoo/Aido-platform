---
'@aido/server': patch
---

푸시 공급자 오류를 `PushFailureKind`로 분류하고, 기기별 `MessageRateExceeded`는 그 메시지만 backoff 뒤 다시 보내며, 공급자 초당 한도를 넘지 않게 발송을 조절한다. receipt는 1분마다 밀린 ticket을 이어서 확인하고 24시간이 지나도 결과가 없으면 결과 미상으로 닫는다. 알림 이벤트는 원인 이벤트별 key로 한 번만 저장하고 재시도를 다 쓰면 dead-letter 큐에 남긴다. 리텐션 발송은 공용 push-delivery outbox를 쓴다.
