---
'@aido/api': minor
'@aido/server': minor
---

소셜 로그인·OAuth 코드 교환 응답에 `isNewUser`를 더한다. 이번 요청에서 계정을 새로 만들었을 때만 true이고, 기존 계정·이메일 자동 연결·탈퇴 유예 복구는 false다. 선택 필드라 구 앱은 무시한다.
