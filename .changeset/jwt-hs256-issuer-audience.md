---
'@aido/server': patch
---

access·refresh 토큰 검증을 HS256만 받게 고정하고(`none`·HS512·RS256 거절) 새로 발급하는 토큰에 `iss`·`aud`를 싣는다. 배포 전에 받은 토큰이 계속 통하도록 `iss`·`aud` 검증은 아직 강제하지 않는다.
