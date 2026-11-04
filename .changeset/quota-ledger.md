---
'@aido/api': minor
'@aido/server': minor
---

AI처럼 돈이 드는 사용 횟수를 Access의 `QuotaLedger` 원장 하나로 센다. AI 호출 전에 원자적으로 예약하고 실패·빈 결과면 정확히 한 번 환불하며, 같은 `Idempotency-Key`는 두 번 차감하지 않는다(`QuotaCharge`·`QuotaUsage` 테이블 추가). 서버가 계산한 `featureQuota`·`entitlementSnapshot` 계약과 `GET /v1/entitlements`를 더하고, parse-todo·parse-memo 성공 응답에 선택 `featureQuota`를, 한도 오류(AI_1303·새 AI_1313 녹음 정리 한도·새 AI_1314 처리 중 충돌)에 공개 상세 `{ charged: false, featureQuota }`를 싣는다. 응원·콕 찌르기 일간 한도(CHEER_1201·NUDGE_1101)와 카테고리 한도(TODO_CATEGORY_0857)도 같은 공개 상세를 싣고, 친구 한도(FOLLOW_0909)는 기존 `current`·`limit`에 `charged`·`featureQuota`를 더한 `friendQuotaErrorDetailsSchema`로 내보낸다. 출시 앱의 `/v1/ai/usage`·`/me`·AI_1303 동작은 그대로다.
