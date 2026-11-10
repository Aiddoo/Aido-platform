# 설정과 환경변수

env를 더하거나 읽는 위치를 바꿀 때, 운영 env를 준비할 때 읽는다. 반영 절차는 [배포](deployment.md#공개-버전과-env-반영)에 있다.

## 규칙

- `@nestjs/config` 공식 namespace 설정을 쓴다. slice마다 `<context>-<slice>.config.ts`에 `registerAs("<name>", () => schema.parse(process.env))`를 두고, 주입은 `@Inject(memosConfig.KEY)`, 타입은 `ConfigType<typeof memosConfig>`다.
- 공용 값(DB·Redis·JWT·Sentry)은 `platform/config`에 둔다.
- `process.env`는 `*.config.ts`에서만 읽는다(`node/no-process-env`).
- env 이름은 운영 계약이라 바꾸지 않는다. 쓰지 않는 env는 코드 사용처가 0인지 확인한 뒤 schema에서 지운다(스키마가 모르는 변수는 버려진다).
- 설정 값 목록(`CACHE_TYPE` 등)은 config 파일 안의 `as const` 튜플에서 `z.enum`으로 유도한다([공유 값](conventions.md#공유-값은-한-곳에서-선언한다)).
- Zod 오류 옵션은 `{ error }`다. env 원문·secret·backup은 로그나 Git에 넣지 않는다.

## 운영 env

설정 정본은 `src/platform/config/schemas`와 `.env*.example`이다. 운영은 OAuth 최소 1개, Resend key, WeatherKit 자격 네 값이 필요하다.

| 설정                                                              | 기본/용도                                                                                                         |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| DATABASE_URL / PGBOSS_DATABASE_URL                                | API DB / 별도 미설정 시 같은 pg-boss DB                                                                           |
| DATABASE_POOL_MAX / _IDLE_TIMEOUT_MS / _CONNECTION_TIMEOUT_MS     | 10 / 비우면 pg 기본값(유휴 10초, 연결 대기 무제한)                                                                |
| NODE_ENV / APP_ENV                                                | 런타임 / 배포 환경. production APP_ENV에서 Sentry를 보내고 RevenueCat Test Store 웹훅을 반영하지 않는다           |
| PORT                                                              | host 기본 8080, API container 8080                                                                                |
| JWT_SECRET / JWT_REFRESH_SECRET / TOKEN_ENCRYPTION_KEY            | 시작 검증에 필요한 32자 이상 값                                                                                   |
| JOB_SCHEMA                                                        | pgboss                                                                                                            |
| CACHE_TYPE / PUSH_RATE_LIMIT_BACKEND                              | memory / postgres; 서로 다른 capability                                                                           |
| REDIS_*                                                           | `CACHE_TYPE=redis` 또는 `PUSH_RATE_LIMIT_BACKEND=redis`일 때의 연결 설정                                          |
| EXPO_ACCESS_TOKEN / RESEND_API_KEY                                | Expo / 이메일 공급자                                                                                              |
| EMAIL_PROVIDER / ADMIN_NOTIFIER_PROVIDER                          | 선택. 기본 `resend` / `discord`. `log`는 보내지 않고 로그만 남기며 운영은 `resend`+키 필수                        |
| ANTHROPIC_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY / OPENAI_API_KEY | AI 업체 키(있는 업체만 사용). 1.13·1.14 동의 사용자는 Gemini만 쓰므로 Google 키는 계속 필요                       |
| AI_PROVIDER_ORDER / AI_MODEL_{ANTHROPIC,GOOGLE,OPENAI}            | 선택. 기본 `anthropic,google,openai` / claude-haiku-5-5·gemini-3.1-flash-lite·gpt-6-luna                          |
| AI_DEADLINE_<TASK>_MS / AI_BREAKER_*                              | 선택. 업체 체인 제한 시간·회로 차단 시간([AI](ai.md))                                                             |
| AI_GENERATION_MODE / AI_BUDGET_*_USD                              | 선택. 킬 스위치(`off`·`interactive-only`, 재시작 필요)와 추정 비용 예산([AI](ai.md))                              |
| WEATHERKIT_TEAM_ID / _KEY_ID / _SERVICE_ID / _PRIVATE_KEY         | 날씨 v2. 모두 있거나 모두 없음, 운영 필수. SERVICE_ID는 앱 번들 ID가 아닌 Services ID, 키는 `\n`을 넣은 한 줄 PEM |
| RETENTION_ONBOARDING_V2_ENABLED                                   | 기본 false; treatment 배정은 별도 운영 설정                                                                       |
| DISCORD_SIGNUP_WEBHOOK_URL / DISCORD_PAYMENT_WEBHOOK_URL          | 운영 가입/결제 채널                                                                                               |
| REVENUECAT_API_V2_SECRET_KEY / REVENUECAT_PROJECT_ID              | 선택. 둘 다 있으면 웹훅 뒤 스토어 상태 대조를 켠다([결제](billing.md)). v2 비밀 키, 권한은 읽기 둘뿐              |
| FEATURE_DISCOVERY_*                                               | 새 기능 소개. 규칙은 아래                                                                                         |

## 새 기능 소개 값

릴리스마다 맞춘다. `.env*.example`의 값은 옛 예시이므로 복사하지 않는다.

- `FEATURE_DISCOVERY_CAMPAIGN_ID`: 그 릴리스 앱에 번들된 id다(`feature-discovery.registry.ts`의 `FEATURE_DISCOVERY_CAMPAIGN_ID`). 앱은 자기가 모르는 id면 소개를 띄우지 않는다.
- `FEATURE_DISCOVERY_MIN_APP_VERSION`: 그 캠페인을 번들한 앱 버전이다.
- `FEATURE_DISCOVERY_LAUNCHED_AT`: 끝이 `Z`인 UTC ISO로 쓴 그 릴리스의 배포 시각이다. 이후 가입자는 소개 대신 활성화 흐름을 본다.

## 전환 중

지금 설정은 `platform/config`의 `TypedConfigService`와 `src/platform/config/schemas`의 schema 파일들이 한곳에서 읽는다. Context를 옮길 때 그 Context가 쓰는 값만 소유 slice의 `*.config.ts`로 나누고 env 이름은 그대로 둔다. 안 쓰는 env(`JOB_POLLING_INTERVAL_SECONDS`, `JOB_BACKEND`, `JOB_REDIS_DRAIN_ENABLED`)는 사용처가 0인지 확인한 뒤 지운다. 옮긴 Context는 `apps/api/architecture.ratchet.json`의 `migratedContexts`에 있다.
