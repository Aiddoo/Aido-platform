---
'@aido/server': patch
---

`sslmode`가 있는 DB 연결은 서버 인증서를 검증한다(이미지에 든 RDS CA 사용). 비상시에만 `DATABASE_SSL_ALLOW_UNVERIFIED=true`로 검증을 끌 수 있고 기본값은 false다.
