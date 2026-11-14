# 설정과 환경변수

env를 더하거나 읽는 위치를 바꿀 때, 운영 env를 준비할 때 읽는다. 반영 절차는 [배포](deployment.md#공개-버전과-env-반영)에 있다.

## 규칙

- 시작 검증은 `src/platform/config/schemas`의 전체 schema(`validateEnv`)가 한 번 한다. env는 여기 등록해야 읽힌다(schema가 모르는 변수는 버려진다).
- 읽는 방법은 namespace 설정이다. [defineConfig](../src/platform/config/define-config.ts)`("<namespace>", schema, (env) => ({ ENV_NAME: env.ENV_NAME, … }))`(`registerAs` + Zod)로 정의하고, 읽기 함수는 schema가 읽는 env 키를 모두 적어야 컴파일된다. 주입은 `@Inject(xConfig.KEY)`, 타입은 `ConfigType<typeof xConfig>`다.
  - 공용은 `platform/config`의 `app`·`database`·`redis`·`jwt`·`sentry`·`cache`·`encryption`·`job`·`throttle`이다. 여러 slice가 같은 env(`SUPPORT_EMAIL`, 서명 대체용 `JWT_SECRET`)를 읽으면 각 slice 설정이 같은 schema 조각을 고른다.
  - slice 소유는 `<context>-<slice>.config.ts`(사례: [identity-auth.config.ts](../src/modules/identity/auth/identity-auth.config.ts), [weather-forecasts.config.ts](../src/modules/weather/forecasts/weather-forecasts.config.ts))이고 slice module이 `ConfigModule.forFeature`로 등록한다.
  - 설정은 부팅 때 `process.env` 원문을 한 번 파싱한다. 요청마다 env를 다시 읽지 않고, 검증을 거친 env를 namespace schema로 다시 파싱하지 않는다(`z.stringbool()` 같은 칸이 검증 뒤 값을 거절한다).
  - 테스트는 설정 provider를 바꾸거나(`overrideProvider(<config>.KEY)`), 여러 namespace가 함께 바뀌는 배포 환경은 앱을 띄우기 전에 env를 넣는다(`createE2eApp({ env })`).
- `process.env`는 `platform/config/env.ts`(`processEnv`)와 `*.config.ts`에서만 읽는다(oxlint `node/no-process-env`).
- env 이름은 운영 계약이라 바꾸지 않는다. 쓰지 않는 env는 코드 사용처가 0인지 확인한 뒤 schema에서 지운다. 배포 env에 남아도 schema가 모르는 키는 무시된다.
- 설정 값 목록은 schema 안의 `as const` 튜플에서 `z.enum`으로 유도한다(`ADMIN_NOTIFIER_PROVIDERS`, [공유 값](conventions.md#공유-값은-한-곳에서-선언한다)).
- Zod 오류 옵션은 `{ error }`다. env 원문·secret·backup은 로그나 Git에 넣지 않는다.

## 배포 환경

런타임 판단은 `NODE_ENV`가 아니라 배포 환경(`appConfig.environment`: `development | staging | production`)을 읽는다. `APP_ENV`가 우선이고, 없으면 `NODE_ENV=production`은 production, 나머지는 development다(개발서버는 production 빌드 + `APP_ENV=development`). 코드는 `NODE_ENV`·`APP_ENV`를 직접 읽지 않고 `appConfig`를 주입받아 환경 이름 대신 아래 스위치와 공급자 값을 읽는다. Sentry 발송과 경보 어댑터([관측](observability.md#환경별-어댑터))도 같은 값을 본다.

| 환경 → 공급자·스위치                                                 | development 로컬 실행               | development 개발서버 | staging                     | production            |
| -------------------------------------------------------------------- | ----------------------------------- | -------------------- | --------------------------- | --------------------- |
| `devTools.exposeErrorDetails`(오류 원문·검증 상세·DB 정보)           | 켬(테스트 실행은 끔)                | 끔                   | 끔                          | 끔                    |
| `devTools.swaggerUi`(`/api/docs`·`/api/admin/docs`)                  | 켬(테스트 실행은 끔)                | 끔                   | 끔                          | 끔                    |
| `devTools.oauthDevRedirects`(`aido-dev://`·localhost·`exp://` 복귀)  | 켬(테스트 실행은 끔)                | 끔                   | 끔                          | 끔                    |
| `devTools.localCorsOrigins`(localhost 출처 추가)                     | 켬(테스트 실행은 끔)                | 끔                   | 끔                          | 끔                    |
| `responseContractCheck`(handler 반환값 응답 계약 검사)               | 켬                                  | 켬                   | 켬                          | 끔                    |
| 웹훅 서명(RevenueCat)                                                | 비밀 있으면 검증, 없으면 건너뜀     | 같음                 | 검증(비밀 없으면 모두 거절) | 검증(비밀 필수)       |
| Test Store 구매 반영                                                 | 반영                                | 반영                 | 반영                        | 받기만 함             |
| `EMAIL_PROVIDER` 비었을 때                                           | 키 있으면 `resend`, 없으면 `log`    | 같음                 | `resend`                    | `resend`(`log` 금지)  |
| `ADMIN_NOTIFIER_PROVIDER` 비었을 때                                  | 웹훅 있으면 `discord`, 없으면 `log` | 같음                 | `discord`                   | `discord`(`log` 금지) |
| `CACHE_TYPE`(캐시·잠금·중복 방지·스로틀) / `PUSH_RATE_LIMIT_BACKEND` | `memory` / `postgres`               | 같음                 | 같음                        | 같음                  |
| `AI_PROVIDER_ORDER` / `AI_GENERATION_MODE`                           | `anthropic,google,openai` / `on`    | 같음                 | 같음                        | 같음                  |
| 초대 해시 비밀(`INVITE_ENABLED=true`일 때)                           | 없으면 로컬 값                      | 같음                 | 필수                        | 필수                  |
| Sentry 발송                                                          | 안 함                               | 안 함                | 안 함                       | DSN 있으면 보냄       |
| 공개 `/health` 상세(`exposeHealthDetails`: 큐·런타임·인스턴스)       | 공개                                | 공개                 | 공개                        | `{ status }`만        |

- 로컬 실행(`appConfig.isLocalRun`)은 배포 환경이 development이고 `NODE_ENV`가 production이 아닐 때다(소스로 띄운 서버·테스트). 개발 도구는 로컬 실행에서만 켠다. 배포된 개발서버(production 빌드 + `APP_ENV=development`)는 외부에서 닿는 주소라 오류 원문·Swagger·OAuth 개발 복귀·localhost CORS를 닫고, 공급자·관측(로그 어댑터, Sentry 끔)만 development 값을 쓴다.
- 테스트 실행(`NODE_ENV=test`)은 출시 응답 계약을 검증하므로 로컬 실행이어도 개발 도구를 끈다.
- 응답 계약 검사(`responseContractCheck`)는 개발 도구가 아니다. 운영 밖(테스트·개발서버·스테이징)에서 켜서 계약에 어긋난 handler 반환값을 배포 전에 잡고, 운영은 요청마다 parse하는 비용을 피하려고 등록하지 않는다.
- `NODE_ENV`를 읽는 곳은 실행 방식이 정하는 세 곳뿐이다: `.env` 파일 고르기(설정을 읽기 전), 로그 형식·기본 레벨(`pino-pretty`가 devDependency라 production 빌드는 JSON, 테스트는 silent), 로컬 실행 판정(`isLocalRun`).

## 공급자 선택

교체 가능한 어댑터는 모두 같은 모양으로 고른다.

1. 설정 schema에 `as const` 공급자 튜플과 env 하나(`EMAIL_PROVIDER`·`ADMIN_NOTIFIER_PROVIDER`·`CACHE_TYPE` 등)를 둔다.
2. 값이 없으면 배포 환경 기본값(`defaultEmailProvider` 등, 위 표)을 쓴다. env에 적은 값은 기본값보다 앞선다.
3. 고르는 곳은 선택 helper 하나(`selectEmailSender`·`selectAdminNotifier`·`selectSharedRedis`·`selectPushRateLimiter`)이고 slice `*.providers.ts`나 platform module이 부른다. UseCase는 포트만 안다.

## 소셜 로그인 콘솔

- Apple은 App ID에 Sign In with Apple을 켜야 한다.
- 공급자 콘솔의 redirect URI는 서버 콜백(`*_CALLBACK_URL`, [oauth.schema.ts](../src/platform/config/schemas/oauth.schema.ts))이다. 앱의 `redirectUri`를 등록하지 않는다(앱 흐름은 [모바일 인증](../../mobile/docs/auth.md#소셜-로그인)).

## 운영 시작 검증

운영에서 위험하거나 빠진 조합은 시작 검증이 부팅을 막는다. 잘못된 설정으로 뜬 서버가 조용히 메일·경보를 버리는 것보다 배포가 실패하는 편이 낫다. `validateEnv`가 운영(위 판정의 production)에서 아래 조합이면 키 이름과 규칙만 적고 값은 싣지 않은 채 시작을 거부한다([production-readiness.ts](../src/platform/config/schemas/production-readiness.ts)).

- `EMAIL_PROVIDER`가 `resend`가 아니거나 `RESEND_API_KEY`가 없다.
- `ADMIN_NOTIFIER_PROVIDER`가 `discord`가 아니다.
- `REVENUECAT_WEBHOOK_SECRET`이 없다(웹훅 서명을 검증할 수 없다).
- 로그인 공급자가 하나도 없다, WeatherKit 네 값 중 빠진 것이 있다.
- staging·production에서 `INVITE_ENABLED=true`인데 `INVITE_CLAIM_HASH_SECRET`이 32자 미만이다.

`SENTRY_DSN`이 없으면 시작은 하고 `config.recommended-value.missing` 경고를 남긴다. 개발 도구는 로컬 실행에서만 유도해 운영에서 켤 설정이 없다. `TOKEN_ENCRYPTION_SALT`는 지금 운영이 기본 salt를 쓰므로 요구하지 않는다. 운영 env 예시 키 구성이 이 검증을 통과하는지는 `production-env.spec.ts`가 본다. 새 공급자·스위치를 더하면 "운영에서 이 값이면 안 된다"를 같은 검증에 더하고 schema spec으로 확인한다.

## 운영 env

설정 정본은 `src/platform/config/schemas`와 `apps/api/.env.example`이다. 운영에서 바꾸는 값은 예시 주석의 "운영"과 [production-env.spec.ts](../src/platform/config/production-env.spec.ts)의 `PRODUCTION_VALUES`가 같게 둔다. 운영 필수 값은 위 [운영 시작 검증](#운영-시작-검증)이다.

| 설정                                                                    | 기본/용도                                                                                                                                                                      |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| DATABASE_URL                                                            | API DB. pg-boss도 같은 DB(`JOB_SCHEMA` 기본 `pgboss`). migrate 도구만 `PGBOSS_DATABASE_URL`을 따로 받을 수 있다                                                                |
| DATABASE_POOL_MAX / _IDLE_TIMEOUT_MS / _CONNECTION_TIMEOUT_MS           | 10 / 비우면 pg 기본값(유휴 10초) / 연결 대기 5초                                                                                                                               |
| DATABASE_SSL_ALLOW_UNVERIFIED                                           | 기본 false. `sslmode`가 있으면 RDS CA(`NODE_EXTRA_CA_CERTS`)로 인증서를 검증하고, 비상시에만 true로 끈다([보안](security.md))                                                  |
| NODE_ENV / APP_ENV                                                      | 런타임 모드 / 배포 환경. 런타임 판단은 배포 환경을 따른다([배포 환경](#배포-환경))                                                                                             |
| PORT                                                                    | host 기본 8080, API container 8080                                                                                                                                             |
| JWT_SECRET / JWT_REFRESH_SECRET / TOKEN_ENCRYPTION_KEY                  | 시작 검증에 필요한 32자 이상 값. `TOKEN_ENCRYPTION_SALT`는 선택(바꾸지 않는다)                                                                                                 |
| CURSOR_SIGNING_KEYS / OPT_OUT_TOKEN_SIGNING_KEYS                        | 선택. `kid:secret,…`(첫 항목이 서명 키, secret 32자 이상). 비우면 JWT_SECRET으로 서명, 기존 토큰은 계속 검증([보안](security.md#서명-키-회전))                                 |
| JOB_SHUTDOWN_TIMEOUT_MS                                                 | 90000. compose `stop_grace_period`(120초)보다 짧게 둔다                                                                                                                        |
| JOB_WORKER_ENABLED / JOB_POOL_MAX                                       | true / 3. `false`면 작업을 넣기만 하는 API 전용 프로세스다([작업과 이벤트](jobs-and-events.md#큐-정의))                                                                        |
| CACHE_TYPE / PUSH_RATE_LIMIT_BACKEND                                    | memory / postgres; 서로 다른 capability([확장](scaling.md))                                                                                                                    |
| REDIS_URL / REDIS_COMMAND_TIMEOUT_MS / REDIS_CONNECT_TIMEOUT_MS         | `CACHE_TYPE=redis`일 때의 연결 주소와 타임아웃(기본 1500 / 5000). redis를 고르고 주소가 없으면 시작을 거부한다                                                                 |
| EXPO_ACCESS_TOKEN / RESEND_API_KEY                                      | Expo / 이메일 공급자                                                                                                                                                           |
| EMAIL_PROVIDER / ADMIN_NOTIFIER_PROVIDER                                | 선택. 비우면 배포 환경 기본값([배포 환경](#배포-환경)). `log`는 보내지 않고 로그만 남기며 운영에서는 시작을 거부한다                                                           |
| ANTHROPIC_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY / OPENAI_API_KEY       | AI 업체 키(있는 업체만 사용). 이전 동의 버전 사용자는 Gemini만 쓰므로 Google 키는 계속 필요                                                                                    |
| AI_PROVIDER_ORDER / AI_MODEL_{ANTHROPIC,GOOGLE,OPENAI}                  | 선택. 기본 `anthropic,google,openai` / claude-haiku-5-5·gemini-3.1-flash-lite·gpt-6-luna                                                                                       |
| AI_DEADLINE_<TASK>_MS / AI_THINKING_<TASK> / AI_BREAKER_*               | 선택. 업체 체인 제한 시간·사고 예산·회로 차단 시간([AI](ai.md))                                                                                                                |
| AI_GENERATION_MODE / AI_BUDGET_*_USD                                    | 선택. 킬 스위치(`off`·`interactive-only`, 재시작 필요)와 추정 비용 예산([AI](ai.md))                                                                                           |
| KMA_API_KEY / WEATHERKIT_TEAM_ID / _KEY_ID / _SERVICE_ID / _PRIVATE_KEY | 날씨. WeatherKit 네 값은 모두 있거나 모두 없음, 운영 필수. SERVICE_ID는 앱 번들 ID가 아닌 Services ID, 키는 `\n`을 넣은 한 줄 PEM                                              |
| RETENTION_ONBOARDING_V2_ENABLED / _TREATMENT_PERCENT                    | 기본 false; treatment 배정 비율                                                                                                                                                |
| INVITE_ENABLED / NUDGE_INTERACTIONS_ENABLED                             | 초대 알림·지급, 콕 답장 기능 스위치                                                                                                                                            |
| DISCORD_SIGNUP_WEBHOOK_URL / DISCORD_PAYMENT_WEBHOOK_URL                | 운영 가입/결제 채널                                                                                                                                                            |
| REVENUECAT_WEBHOOK_SECRET                                               | 웹훅 Authorization 비교 값. 운영 필수                                                                                                                                          |
| REVENUECAT_API_V2_SECRET_KEY / REVENUECAT_PROJECT_ID                    | 선택. 둘 다 있으면 웹훅 뒤 스토어 상태 대조를 켠다([결제](billing.md#웹훅-뒤-스토어-상태-대조)). v2 비밀 키, 권한은 읽기 둘뿐                                                  |
| APP_VERSION_CHECK_*                                                     | 전환기 대체값. `_ENABLED`(기본 false)·`_IOS_LATEST_VERSION`·`_ANDROID_LATEST_VERSION`. DB `AppRelease`에 행이 없는 플랫폼만 읽는다([배포](deployment.md#공개-버전과-env-반영)) |
| FEATURE_DISCOVERY_*                                                     | 새 기능 소개. 규칙은 아래                                                                                                                                                      |

## 새 기능 소개 값

릴리스마다 맞춘다. `.env.example`의 값은 옛 예시이므로 복사하지 않는다.

- `FEATURE_DISCOVERY_CAMPAIGN_ID`: 그 릴리스 앱에 번들된 id다(모바일 `features/app-config/whats-new/constants/releases.constants.ts`의 `campaignId`). 앱은 자기가 모르는 id면 소개를 띄우지 않는다.
- `FEATURE_DISCOVERY_MIN_APP_VERSION`: 그 캠페인을 번들한 앱 버전이다.
- `FEATURE_DISCOVERY_LAUNCHED_AT`: 끝이 `Z`인 UTC ISO로 쓴 그 릴리스의 배포 시각이다. 켜면 필수이고 응답에 그대로 나간다. 1.15.0 이하 앱만 읽어 이 시각 전 가입자에게만 소개를 자동으로 열고 이후 가입자에게 시작 체크리스트를 보인다. 1.15.1 앱은 읽지 않고 가입 시점과 상관없이 소개를 한 번 연다.
