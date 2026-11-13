---
'@aido/server': patch
---

서버 이미지를 Node 26.13.1(2026-11 보안 릴리스)로 올리고 Redis 클라이언트를 ioredis 6으로 올린다(Redis 캐시를 켤 때만 쓰며 재접속은 ioredis 6 기본 지수 백오프).
