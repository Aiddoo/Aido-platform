---
'@aido/api': minor
'@aido/server': minor
---

푸시를 보내지 않은 이유를 기기 권한으로 나눈다. 활성 토큰이 없을 때 최근 90일 안에 보고한 기기가 거절이면 `PUSH_PERMISSION_DENIED`, 아직 묻지 않았으면 `PUSH_PERMISSION_NOT_REQUESTED`, 그 밖에는 `NO_ACTIVE_TOKEN`으로 기록한다. v2 관리자 캠페인 조회의 `dispatches`에 사유별 수 `skippedByReason`을 더한다(추가 필드).
