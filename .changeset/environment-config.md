---
'@aido/server': patch
---

런타임 판단을 `NODE_ENV` 대신 배포 환경(`APP_ENV`, 없으면 `NODE_ENV=production`이면 production) 하나로 읽는다. 개발 전용 동작(오류 상세·Swagger UI·OAuth 개발 복귀 주소·localhost CORS)은 development 배포 환경에서만 켜지고 staging·production·테스트 실행에서는 꺼진다. 그래서 production 빌드로 도는 개발서버(`APP_ENV=development`)는 이제 Swagger·오류 상세를 연다. RevenueCat 웹훅 서명은 비밀이 있으면 모든 환경에서 검증하고, 비밀이 없으면 개발 환경만 건너뛰며 staging·production은 모두 거절한다. 초대 해시 비밀 요구도 staging까지 같은 기준이다. 운영에서 `EMAIL_PROVIDER`·`ADMIN_NOTIFIER_PROVIDER`가 `log`이거나, `RESEND_API_KEY`·`REVENUECAT_WEBHOOK_SECRET`이 없거나, 로그인 공급자·WeatherKit 자격이 빠지면 키 이름만 적고 시작을 거부한다(값은 싣지 않는다). `SENTRY_DSN`이 없으면 경고만 남긴다. 운영의 공개 `/health`는 큐 이름·실패 수·런타임 수치 없이 `{ status }`와 200/503만 준다(개발·스테이징은 상세를 그대로 준다). 비워 둔 `EMAIL_PROVIDER`·`ADMIN_NOTIFIER_PROVIDER`는 staging·production에서 `resend`·`discord`, 개발에서는 키·웹훅이 있을 때만 실제 공급자다. pg-boss client가 검증을 거친 env를 다시 파싱하다 `DATABASE_SSL_ALLOW_UNVERIFIED`에서 실패하던 경로를 없앴다. env 이름·HTTP 계약은 그대로다. 배포 전 운영 서버 env에 `REVENUECAT_WEBHOOK_SECRET`이 있는지 확인한다.
