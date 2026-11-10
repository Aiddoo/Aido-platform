---
'@aido/server': patch
---

푸시 receipt 확인 주기를 매분에서 5분으로 바꾼다. Expo 권장대로 수락 15분 지난 ticket만 조회하는 규칙은 그대로라 결과는 같고 빈 작업 행만 줄어든다.
