---
'@aido/api': minor
'@aido/server': minor
---

출시 전 응답인 `POST /v1/quick-plans`, `POST /v1/voice-notes/digest`에서 `meta`(모델·토큰·프롬프트 버전)를 뺀다. 값은 서버 로그에만 남긴다. `parse-todo`, `parse-memo`의 응답은 그대로다.
