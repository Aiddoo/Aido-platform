# 보안

인증 토큰·서명 키·암호화·DB 연결·웹훅·AI 데이터 처리를 바꿀 때 읽는다. 로그·Sentry에 남기면 안 되는 값은 [관측](observability.md#남기면-안-되는-값), env 목록은 [설정](configuration.md)에 있다.

## 규칙

| 항목           | 지금 동작                                                                                                                                                                                          | 바꿀 때 지킬 것                                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| JWT            | `algorithms: [JWT_ALGORITHM]`(HS256) 고정. 새 토큰은 `iss`·`aud`를 싣는다(`jwt-token-issuer.adapter.ts`). 검증 강제는 다음 릴리스다(`jwt-auth.guard.ts`)                                           | 강제는 배포 전 발급한 refresh 토큰(7일)이 모두 바뀐 뒤                                                             |
| HMAC 서명 키   | 용도별 key ring([SigningKeyRing](../src/platform/security/signing-key-ring.ts)): `CURSOR_SIGNING_KEYS`(댓글 커서), `OPT_OUT_TOKEN_SIGNING_KEYS`(광고 수신 거부 링크). 비우면 `JWT_SECRET`으로 서명 | 검증은 ring 키와 `JWT_SECRET`(kid 없는 옛 토큰)을 모두 받는다                                                      |
| PostgreSQL TLS | URL `sslmode`(운영 `require`)가 있으면 TLS + 인증서 검증(`rejectUnauthorized: true`, 이미지의 RDS CA `NODE_EXTRA_CA_CERTS`). `DATABASE_SSL_ALLOW_UNVERIFIED=true`는 비상 스위치                    | 배포 전 EC2에서 같은 URL로 연결을 확인한다. 실패면 배포하지 않는다                                                 |
| 토큰 암호화    | `TOKEN_ENCRYPTION_KEY`로 scrypt 키를 만든다. `TOKEN_ENCRYPTION_SALT`가 없으면 기본 salt 상수다                                                                                                     | 운영 암호문이 그 값으로 만들어져 salt를 바꾸지 않는다                                                              |
| 예외·경보      | `ExceptionReporterPort`·`OperationalAlertPort`로만 보낸다(Sentry 직접 호출 금지)                                                                                                                   |                                                                                                                    |
| helmet·CORS    | `helmet()` 기본값(JSON API), CORS는 `CORS_ORIGINS` 화이트리스트(`createCorsOptions`)                                                                                                               |                                                                                                                    |
| 스로틀         | 기본 메모리 저장소. `CACHE_TYPE=redis`면 `RedisThrottlerStorage`([확장](scaling.md))                                                                                                               |                                                                                                                    |
| 웹훅           | RevenueCat은 정적 Authorization을 `timingSafeEqual`로 비교(`revenuecat-webhook-signature.guard.ts`). receipt 멱등과 사용자 웹훅 잠금을 유지한다                                                    | 비밀이 없으면 개발만 건너뛰고 staging·production은 모두 거절, 운영은 시작 거부([설정](configuration.md#배포-환경)) |
| 비밀번호·세션  | argon2id(64MiB/3/4), refresh family 재사용 탐지, 전역 JWT guard + `@Public`. Passport 없이 `JwtService`로 검증한다                                                                                 |                                                                                                                    |
| 비밀값         | env에만 둔다. 로그·문서·커밋에 쓰지 않는다                                                                                                                                                         | redaction에 새 키 이름을 더한다                                                                                    |

- 비밀 하나에 여러 용도를 묶지 않는다. 용도마다 키를 나눠야 하나씩 회전할 수 있다.
- 로그인 본문의 `deviceName`·`deviceType`은 출시 앱 호환으로 받기만 한다. 비밀번호 로그인은 `deviceName`을 세션의 기기 지문(없으면 User-Agent)에, 소셜 로그인은 둘을 신규 가입 관리자 알림의 기기 표시([관리자 알림](admin-notifications.md))에만 쓴다. 세션 목록의 `deviceName`·`deviceType`은 늘 null이고 둘 다 신뢰 판단에 쓰지 않는다.

## 서버와 네트워크

- 밖에서 닿는 문은 Nginx(80·443)와 키 전용 SSH(22)뿐이다. API 컨테이너는 서버 안(`127.0.0.1`)에만 열고, RDS는 서버의 보안 그룹만 받는다. 포트 표는 [README](../../../README.md#운영-인프라)에 있다.
- 운영 컨테이너는 비루트·읽기 전용 루트·capability 제거·`no-new-privileges`로 돈다([production compose](../../../docker-compose.prod.yml)).
- Nginx·sshd·자동 보안 패치 설정의 정본과 설치 위치는 [서버 설정과 관리](deployment.md#서버-설정과-관리)에 있다.
- 이미지는 Trivy 검사를 통과한 것만 발행하고 서버에서 빌드하지 않는다([CI](ci.md)).

## 서명 키 회전

1. ring 앞에 새 `kid:secret`(secret 32자 이상)을 더해 배포한다. 첫 항목이 서명 키이고 나머지는 검증만 한다.
2. 옛 키로 서명한 값의 수명(커서·수신 거부 링크)이 지난 뒤 옛 키를 ring에서 뺀다.
3. `JWT_SECRET` 대체 검증(kid 없는 토큰)은 롤백 가능성이 없어지고 ring을 설정한 다음 릴리스에 지운다.
4. AI 공급자 키는 공급자 콘솔에서 새 키를 만들고 env를 바꾼 뒤 API만 재생성한다([배포](deployment.md#공개-버전과-env-반영)). 키가 없거나 거절되면 그 공급자만 체인에서 빠진다.

## 세션 토큰 운영 불변식

앱의 세션 규칙은 [모바일 인증](../../mobile/docs/auth.md#세션-수명주기와-불변식)에 있다. 서버 설정이 깨면 출시 앱 전체가 로그아웃된다.

- `JWT_REFRESH_SECRET` 회전은 전체 유저 즉시 로그아웃이다. 불가피하면 이중 키 검증 기간을 두고 회전한다.
- `JWT_REFRESH_EXPIRES_IN`(기본 7d)은 회전 때마다 새로 계산되어 활성 유저는 만료되지 않는다. 그 기간 이상 접속하지 않은 유저는 다시 로그인한다.
- 리프레시 토큰 재사용 grace는 10초(`TOKEN_REUSE_GRACE_PERIOD_MS`)다. 앱의 갱신 타임아웃(8초)보다 항상 길게 둔다.

## AI

ai-assistance가 소유한다. 장치는 다음과 같고 상세는 [AI](ai.md#프롬프트-보안)에 있다.

| 위협          | 장치                                                                                                                                   |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 프롬프트 주입 | 지시는 서버 상수 system에만. 사용자·저장 데이터는 `wrapUntrusted`로 데이터 블록에만. 도구 호출은 쓰지 않는다                           |
| 출력 오용     | `Output.object`(Zod)로만 받고 id·날짜·개수는 서버가 다시 정한다. 푸시 문구에 모델 출력이 들어가지 않는다                               |
| 개인정보      | 본인 데이터만, 동의 확인(배경 작업은 실행 시점에 `ScheduledAiConsentReader`로 다시 확인), 로그에 AI 입출력 없음, OpenAI `store: false` |
| 남용·비용     | 분당 throttle, `QuotaLedger` 예약·환불, 입력 상한, `maxOutputTokens`, 전역·사용자 예산, 킬 스위치 `AI_GENERATION_MODE`, 회로·bulkhead  |
| 유해 출력     | Gemini `safetySettings` `BLOCK_ONLY_HIGH`, `content-filter`는 `BLOCKED`로 분류                                                         |

- Sentry AI 추적은 `sentryIntegrations()`(`platform/config/utils/sentry-options.ts`)가 `vercelAIIntegration({ recordInputs: false, recordOutputs: false })`로 명시해 끈다. Sentry 11 기본값은 AI span에 입력·system·응답 문장을 싣는다(직접 확인). `sentry-ai-span.spec.ts`가 실제 `generateText` span에 `gen_ai.input.messages`·`gen_ai.output.messages`·`gen_ai.system_instructions`가 없는지 본다. Sentry `release`는 서버 `package.json` 버전(`aido-server@<version>`)이다.
- 동의 판정은 `AiDataSharingConsent` Entity의 `allowsAiProcessingAt(now, requiredVersion)` 하나로 모은다. HTTP guard·배경 작업·음성 계획이 ai-assistance `canShareWithAi`를 거쳐 모두 그것을 쓴다.
- 공급자 데이터 정책(학습 미사용·보관 설정)은 `AiProviderAdapter.dataHandling` 필드로 선언하고 앱 개인정보 문구(국외 이전)와 맞춘다.
- 새 라이브러리를 들이지 않는다. 입력 PII 마스킹은 파싱 품질을 떨어뜨리고 동의 범위 안의 본인 데이터라 넣지 않는다.
