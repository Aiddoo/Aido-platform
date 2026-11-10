# 보안

인증 토큰·서명 키·암호화·DB 연결·웹훅·AI 데이터 처리를 바꿀 때 읽는다. 로그·Sentry에 남기면 안 되는 값은 [관측](observability.md#남기면-안-되는-값)에 있다.

## 규칙

| 항목           | 규칙                                                                                                                                                                                              | 호환                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| JWT            | `algorithms: ["HS256"]` 고정. 새 토큰에 `iss`·`aud`를 싣고, 검증 강제는 기존 refresh 토큰(7일)이 모두 바뀐 뒤                                                                                     | 배포 전 발급한 access·refresh 유효 |
| HMAC 서명 키   | 용도별 key ring(`CURSOR_SIGNING_KEYS`, `OPT_OUT_TOKEN_KEYS`, `kid` 포함). 새 서명은 새 키, 검증은 새 키와 기존 `JWT_SECRET`을 모두 받는다. `JWT_SECRET` 대체 검증은 다음 릴리스에 지운다          | 이미 보낸 수신 거부 링크·커서 유효 |
| PostgreSQL TLS | `sslmode=verify-full`(이미지에 RDS CA가 있다). 배포 전 EC2에서 같은 URL로 `psql "sslmode=verify-full"`을 확인한다                                                                                 | 확인 실패면 배포하지 않는다        |
| 암호화 salt    | 운영에서 기본 salt 상수를 쓰면 부팅 실패. 현재 운영값은 유지한다                                                                                                                                  | 기존 암호문 복호 확인              |
| 예외·경보      | `ExceptionReporterPort`·`OperationalAlertPort`로만 보낸다(Sentry 직접 호출 금지)                                                                                                                  | 없음                               |
| helmet·CORS    | helmet 기본값(JSON API), dev Swagger 경로만 CSP 예외. CORS는 화이트리스트                                                                                                                         | 없음                               |
| 스로틀         | 인스턴스 1대라 메모리 저장소. 2대 이상이면 Redis([확장](scaling.md))                                                                                                                              | 없음                               |
| 웹훅           | RevenueCat은 정적 Authorization(제공 방식)과 `timingSafeEqual`. 비밀이 없으면 개발 환경만 건너뛰고 staging·production은 모두 거절하며 운영은 시작을 거부한다. receipt 멱등과 계정 잠금을 유지한다 | 없음                               |
| 비밀번호·세션  | argon2id(64MiB/3/4), refresh family 재사용 탐지, 전역 Jwt guard + `@Public`                                                                                                                       | 없음                               |
| 비밀값         | env에만 둔다. 로그·문서·커밋에 쓰지 않는다. redaction에 새 키 이름(`*_KEYS`)을 더한다                                                                                                             | 없음                               |

- 비밀 하나에 여러 용도를 묶지 않는다. 용도마다 키를 나눠야 하나씩 회전할 수 있다.
- Passport 없이 공식 `JwtService` 기반 guard로 검증한다. 세션 검증·캐시·상태 검사 동작은 그대로 둔다.
- 로그인 본문의 `deviceName`·`deviceType`은 출시 앱 호환으로 받기만 한다. 비밀번호 로그인은 `deviceName`을 세션의 기기 지문(없으면 User-Agent)에, 소셜 로그인은 둘을 신규 가입 관리자 알림의 기기 표시([관리자 알림](admin-notifications.md))에만 쓴다. 세션 목록의 `deviceName`·`deviceType`은 늘 null이고 둘 다 신뢰 판단에 쓰지 않는다.

## 키 회전

1. key ring에 새 `kid`와 키를 더하고 서명 키로 지정해 배포한다(검증은 옛 키도 받는다).
2. 옛 키로 서명한 값의 수명(커서·수신 거부 링크·refresh 7일)이 지난 뒤 옛 키를 ring에서 뺀다.
3. AI 공급자 키는 공급자 콘솔에서 새 키를 만들고 env를 바꾼 뒤 API만 재생성한다([배포](deployment.md#공개-버전과-env-반영)). 키가 없거나 거절되면 그 공급자만 체인에서 빠진다(테스트로 확인).

## AI

이미 있는 장치는 동작을 그대로 두고 구조만 옮긴다. 상세는 [AI](ai.md#프롬프트-보안)에 있다.

| 위협          | 장치                                                                                                                                                |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 프롬프트 주입 | 지시는 서버 상수 system에만. 사용자·저장 데이터는 `wrapUntrusted`(이스케이프·보이지 않는 문자 제거·NFKC)로 데이터 블록에만. 도구 호출은 쓰지 않는다 |
| 출력 오용     | `Output.object`(Zod)로만 받고 id·날짜·개수는 서버가 다시 정한다. 앱은 일반 텍스트로 그리고 푸시 문구에 모델 출력이 들어가지 않는다                  |
| 개인정보      | 본인 데이터만, 동의 확인(배경 작업은 실행 시점에 다시 확인), 로그·Sentry에 AI 입출력 없음, OpenAI `store: false`                                    |
| 남용·비용     | 분당 throttle, `QuotaLedger` 예약·환불, 입력 상한, `maxOutputTokens`, 전역·사용자 예산, 킬 스위치 `AI_GENERATION_MODE`, 회로·bulkhead               |
| 유해 출력     | Gemini `safetySettings` `BLOCK_ONLY_HIGH`, `content-filter`는 `BLOCKED`로 분류                                                                      |

- Sentry AI 추적은 `sentryIntegrations()`(`platform/config/utils/sentry-options.ts`)가 `vercelAIIntegration({ recordInputs: false, recordOutputs: false })`로 명시해 끈다. Sentry 11 기본값은 AI span에 입력·system·응답 문장을 싣는다(직접 확인). `sentry-ai-span.spec.ts`가 실제 `generateText` span에 `gen_ai.input.messages`·`gen_ai.output.messages`·`gen_ai.system_instructions`가 없는지 본다. Sentry `release`는 서버 `package.json` 버전(`aido-server@<version>`)이다.
- 동의 판정은 `AiDataSharingConsent` Entity의 `allowsAiProcessingAt(now, requiredVersion)` 하나로 모은다. HTTP guard·배경 작업·음성 계획이 모두 그것을 쓴다.
- 공급자 데이터 정책(학습 미사용·보관 설정)은 `AiProviderAdapter.dataHandling` 필드로 선언하고 앱 개인정보 문구(국외 이전)와 맞춘다.
- 새 라이브러리를 들이지 않는다. 입력 PII 마스킹은 파싱 품질을 떨어뜨리고 동의 범위 안의 본인 데이터라 넣지 않는다.

## 전환 중

지금 코드는 JWT `algorithms`·`iss`·`aud` 없이 검증하고, `JWT_SECRET`을 커서 HMAC·수신 거부 토큰에도 쓰며, DB TLS를 `rejectUnauthorized: false`로 연결한다. 보안 강화 변경이 들어오기 전까지는 위 표의 "호환" 열을 지키는 순서로만 바꾼다.
