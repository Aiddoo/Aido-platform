# AI 기능 (파싱·리포트·제안)

AI 작업의 프롬프트 버전·설정·평가를 바꿀 때 참고한다. 코드는 `apps/api/src/modules/ai-assistance`가 소유한다.

## 역할 분리

- LLM은 언어 해석만 한다. 파싱 v2의 모델 출력은 날짜가 아니라 일정 표현(`TodoDraft`)이고, 날짜·요일·시각은 순수 함수 `domain/services/parsing/resolve-todo-schedule.ts`가 사용자 시간대 기준으로 계산한다.
- 스키마는 세 단계다. LLM 스키마(관대, 길이·개수 제한 없음) → 서버 정규화 → `@aido/api` 공개 계약으로 최종 검증. 공개 계약은 optional `meta.promptVersion`과 parse-memo의 optional `meta.omittedTodoCount` 외에 바뀌지 않았다.
- parse-memo는 할 일을 합치지 않는다. 입력 순서대로 앞의 5개까지 만들고 나머지 수를 `meta.omittedTodoCount`로 알린다(메모 원문은 그대로 남는다). 서브투두도 합치지 않고 앞의 5개만 둔다.
- 긴 메모가 `maxOutputTokens`를 넘어 TRUNCATED가 되지 않도록 v2 모델은 할 일을 앞의 8개까지만 쓰고, 메모 전체 할 일 수를 LLM schema의 optional `totalTaskCount`로 함께 낸다. `totalTaskCount`는 schema에서 `todos` 뒤에 둔다(앞에 두면 사고 토큰이 적은 응답에서 과대 집계가 잦았다). 남은 수는 `max(totalTaskCount, 받은 할 일 수) − 5`이고, 모델이 전체 수를 빠뜨리면 받은 할 일 수로 센다.
- 일정 계산은 사용자가 말한 날짜·시각을 우선한다. 날짜 없이 말한 때("아침에")가 오늘 이미 지났으면 다음 날 그 때로 넘기고, "오늘 아침"처럼 오늘을 말했는데 지났으면 오늘 종일로 둔다(지난 기본 시각을 만들지 않는다). 숫자 시각("오늘 오전 9시")은 지났어도 그대로 둔다. 상대 시각(`relativeMinutes`)은 1분 이상이고 날짜가 없거나 오늘일 때만 쓰며, 0이나 "내일"과 함께 온 값은 무시한다.
- 리포트·제안도 서버가 근거 데이터를 만들고(기간 날짜·달성률 차이·후보 목록) 모델은 문장만 쓰거나 후보를 고른다. 리포트 정규화는 ko의 "~요냥"(해요체 뒤에 붙인 냥)과 en의 "meow"를 지운다(`domain/services/reports/report-persona.ts`). 리포트 summary·팁에서 report_data에 없는 숫자를 쓴 문장은 빼고, 남는 summary나 팁이 없으면 폴백으로 저장한다. 제안 사유와 리포트 문장의 숫자는 서버 근거와 사용자가 쓴 이름의 분량("30개")만 허용하며 단위가 다르면 거른다(`domain/services/grounding/grounded-numbers.ts`).

## 프롬프트 버전

| 작업       | 폴더                                               | 버전 ID                            |
| ---------- | -------------------------------------------------- | ---------------------------------- |
| parse-todo | `application/prompts/parsing/parse-todo/v1·v2`     | `parse-todo@v1`, `parse-todo@v2.1` |
| parse-memo | `application/prompts/parsing/parse-memo/v1·v2`     | `parse-memo@v1`, `parse-memo@v2.1` |
| report     | `application/prompts/reports/report/v1·v2`         | `report@v1`, `report@v2.1`         |
| suggestion | `application/prompts/suggestions/suggestion/v1·v2` | `suggestion@v1`, `suggestion@v2.1` |

- 기능 폴더의 `index.ts`가 버전별 정의(`promptVersion`·`build`·LLM schema+정규화)를 묶고, use case는 설정에 맞는 정의만 고른다.
- 두 파싱 v2가 함께 쓰는 규칙·LLM schema는 `parsing/shared/v2`, v1의 시간 규칙은 `parsing/shared/v1`에 있다.
- 같은 폴더 안에서 지시 문구나 정규화만 바뀌면 버전 ID의 minor를 올린다(`@v2` → `@v2.1`). 폴더·env 값(`v2`)은 그대로이고, 관측 로그와 `AiReport.promptVersion`으로 바뀐 시점 전후를 구분한다.
- v1은 롤백용으로만 남기며 모든 v1 모듈은 `@deprecated`다. 제거 지점은 `TODO: 1.13.0 이전 앱 사용자가 업데이트한 뒤`로 검색한다.

## 운영 설정 (env, 키 외 모두 선택)

| 키                                                                      | 값                                    | 기본                                                        |
| ----------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------- |
| `ANTHROPIC_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` / `OPENAI_API_KEY` | 업체 키(빈 값은 미설정)               | 없음 — 키가 있는 업체만 쓴다                                |
| `AI_PROVIDER_ORDER`                                                     | `anthropic,google,openai`의 부분 순서 | `anthropic,google,openai`                                   |
| `AI_MODEL_{ANTHROPIC,GOOGLE,OPENAI}`                                    | 모델 ID                               | `claude-haiku-5-5` / `gemini-3.1-flash-lite` / `gpt-6-luna` |
| `AI_PROMPT_VERSION_<TASK>`                                              | `v1` \| `v2`                          | `v2`                                                        |
| `AI_THINKING_<TASK>`                                                    | `minimal` \| `low` \| `medium`        | `PARSE_TODO`는 `minimal`, 나머지 `low`                      |
| `AI_DEADLINE_<TASK>_MS`                                                 | 업체 체인 전체 제한 시간              | 12000 / 25000 / 60000 / 60000 / 15000 / 45000               |
| `AI_BREAKER_BILLING_COOLDOWN_MS`                                        | 결제·인증 실패 뒤 건너뛰는 시간       | 900000 (15분)                                               |
| `AI_BREAKER_HEALTH_THRESHOLD` / `_COOLDOWN_MS`                          | 연속 장애 횟수 / 건너뛰는 시간        | 5 / 30000                                                   |

`<TASK>`는 `PARSE_TODO`·`PARSE_MEMO`·`REPORT`·`SUGGESTION`·`QUICK_PLAN`·`VOICE_NOTE_DIGEST`(프롬프트 버전은 앞의 넷만)다. 기본값은 `platform/config/schemas/ai.schema.ts` 한 곳에 있고 `TypedConfigService.ai`가 업체·작업 단위로 묶어 한 번 파싱한다. 2026-10-26 live eval에서 parse-todo는 `minimal`이 `low`와 정확도가 같고(어려운 16건 16/16) p50이 1725→1239ms로 짧아 `minimal`을 쓴다. parse-memo는 `minimal`에서 `totalTaskCount`를 과대 집계해(긴 메모 5/5, 프롬프트 v2.1 뒤에도 5/5) `low`를 유지한다. 리포트·제안은 야간 배치라 지연 이득이 작아 `low`를 유지한다. 작업별 토큰 상한·마지막 업체 SDK 재시도 수는 `infrastructure/adapters/generation/ai-generation-policy.ts`에 있다. Claude는 thinking을 `effort`(minimal·low → low, medium → medium)로, OpenAI는 `reasoningEffort`로, Gemini는 `thinkingLevel`로 보낸다.

## 업체 체인·폴백·회로

- Application은 `AI_GENERATOR`(`AiGeneratorPort.generate`) 하나만 안다(`ai-assistance-generation.public.ts`). 구현 `AiSdkGenerator`는 `ai-route.policy.ts`(순수 함수)로 업체 순서를 정한다: `AI_PROVIDER_ORDER` → 키가 있는 업체 → 사용자가 동의한 안내 버전이 허용한 업체(`ai-processor-consent.policy.ts`, 표는 `@aido/api/vocabulary`의 `AI_DATA_SHARING_CONSENT_PROVIDERS`) → 회로가 열린 업체 제외.
- 동의 버전: 2026-10-26(1.13·1.14 앱) 동의는 Google만, 2026-11-04(1.15) 동의는 Anthropic·Google·OpenAI를 쓴다. 동의 화면이 없던 1.13 미만 앱 요청(동의 버전 없음)은 그때 안내한 Google만 쓴다. 이전 버전 동의 사용자에게 다시 묻지 않는다. use case는 identity 동의 reader에서 동의한 버전을 읽어 `agreedConsentVersion`으로 넘긴다.
- 업체별 SDK 옵션과 오류 본문 해석은 `providers/{anthropic,google,openai}.provider-adapter.ts`(multi 토큰 `AI_PROVIDER_ADAPTERS`) 안에만 있다. Claude 402 `billing_error`·OpenAI 429 `insufficient_quota`·Gemini 429/400의 결제 문구는 `QUOTA_EXHAUSTED`, 401/403·잘못된 키는 `AUTH`, Claude 529·503은 `OVERLOADED`, Gemini safety 400·OpenAI content policy는 `BLOCKED`다. 기록된 오류 본문은 `apps/api/test/fixtures/providers/ai/<업체>/`에 있다.
- 앞 업체는 SDK 재시도 없이(`maxRetries: 0`) 바로 넘기고 마지막 업체만 작업의 재시도 수를 쓴다. 체인 전체에 작업별 제한 시간 하나(`AbortSignal.any`)를 건다. 스키마 불일치(`INVALID_OUTPUT`)는 업체마다 한 번 더 묻고, `BLOCKED`·`TRUNCATED`는 다른 업체도 같게 실패하므로 넘기지 않는다.
- 회로(cockatiel, 프로세스 메모리 — 단일 컨테이너): 결제 회로는 `QUOTA_EXHAUSTED`·`AUTH` 한 번에 열고 15분 뒤 시험 호출, 장애 회로는 `OVERLOADED`·`UPSTREAM`·`TIMEOUT` 연속 5번에 30초 연다. 결제 회로가 열리면 `AiProviderAlertPort`(Sentry `SentryAiProviderAlertAdapter`, 태그 `ai_provider`·`ai_task`)로 "Claude 크레딧 소진, 다음 순서 AI 업체로 전환" 이슈를 남긴다.
- 비용: `AI_MODEL_PRICING`(1M 토큰당 claude-haiku-5-5 $0.10/$0.50, gemini-3.1-flash-lite $0.25/$1.50, gpt-6-luna $0.10/$0.50)으로 모든 시도의 토큰을 더해 `estimatedCostMicroUsd`를 낸다. 단가를 모르는 모델로 바꾸면 null이다. OpenAI는 `store: false`로 응답을 저장하지 않고, 출력 스키마에 생략 가능한 필드가 있어 strict JSON schema를 끈다(서버 Zod가 다시 검증). Claude는 4,096자 이상 고정 지시문에 `cacheControl`을 붙이고 Gemini·OpenAI는 업체 자동 캐시를 쓴다.

## 오류·사용량

생성 실패 종류와 처리는 `application/ports/generation/ai-generation.errors.ts`의 표 하나가 정한다.

| 종류                            | 폴백                    | 회로    | 응답    |
| ------------------------------- | ----------------------- | ------- | ------- |
| QUOTA_EXHAUSTED · AUTH          | 예                      | billing | AI_1301 |
| RATE_LIMITED                    | 예                      | -       | AI_1310 |
| OVERLOADED · UPSTREAM · TIMEOUT | 예                      | health  | AI_1301 |
| BAD_REQUEST                     | 예(error 로그)          | -       | AI_1302 |
| BLOCKED · TRUNCATED             | 아니오                  | -       | AI_1302 |
| INVALID_OUTPUT                  | 업체당 1회 재질문 뒤 예 | -       | AI_1302 |
| UNAVAILABLE(보낼 업체 없음)     | -                       | -       | AI_1301 |

끝내 실패하면 마지막 시도의 종류로 응답한다. 사용자 요청의 AI_1301·AI_1302·AI_1310은 예약을 환불한 뒤 던지므로 공개 상세 `{ charged: false }`를 싣는다(앱 문구 "횟수는 차감되지 않았어요"). 실패와 모델 대상 명령만 있는 입력(NO_ACTION)은 사용량을 차감하지 않는다. 사용량은 Access의 `QuotaLedger`가 센다: 공급자 호출 전에 `reserve`(한도 초과 AI_1303, 녹음 정리 AI_1313, 같은 키 처리 중 AI_1314 — 모두 `details: { charged: false, featureQuota }`), 결과를 주면 `commit`, 실패는 `refund(FAILED)`, NO_ACTION은 `refund(NO_ACTION)`이고 환불은 정확히 한 번이다. 요청마다 `QuotaCharge` 한 줄이 남아 고객 문의 때 차감·환불을 설명한다. 성공 응답은 갱신된 `featureQuota`를 함께 준다. 리포트는 일시 실패(`RATE_LIMITED`·`OVERLOADED`·`UPSTREAM`·`TIMEOUT`)를 마지막 잡 시도 전까지 다시 던지고, 이후에만 폴백을 `contentSource = FALLBACK`으로 저장한다. 보낼 업체가 없으면 리포트는 폴백을 저장하고 제안은 건너뛴다.

## 관측

모든 작업은 `ai.generation.completed`/`ai.generation.failed` 하나의 형식으로 남긴다: `task`, `promptVersion`, `provider`, `model`, `attempts`, `fallbackFrom`, `estimatedCostMicroUsd`, `latencyMs`, 입력·출력·사고 토큰, `finishReason`, `outcome`, `errorType`(공급자 실패 분류), 파싱 응답 `errorCode`, `statusCode`, `quotaCharged`, `userId`. 공급자 실패는 `upstream`(`errorType` = 오류 이름, `statusCode`, 오류 본문의 `providerStatus` 예: `UNAVAILABLE`·`billing_error`, 네트워크 `networkCode` 예: `ECONNRESET`)으로 원인을 남긴다. 업체 경계에서는 `ai.provider.fallback`(task·from·to·errorType·statusCode)과 `ai.provider.circuit.{opened,half-open,closed}`(provider·breaker·reason)를 남긴다. 고정 기호만 담고 공급자 message·응답 본문·사용자 원문·제목·카테고리 이름은 남기지 않는다.

## 프롬프트 보안

- 지시는 AI SDK `instructions`(system)에만 둔다. system은 서버 상수이고 사용자·저장 데이터는 user 턴의 데이터 블록(`<user_input>`·`<context>`·`<report_data>`·`<suggestion_data>`)에만 들어간다. 각 system의 `<security>`·`<grounding>`이 블록 안 문자열을 데이터로 다루라고 명시한다.
- 데이터 블록은 모두 `shared/domain/prompt/sanitize.ts`의 `encodeUntrustedJson`으로 만든다. JSON 문자열로 넣고 `<`·`>`·`&`를 이스케이프해 태그를 닫거나 열 수 없고, 모든 문자열 값에서 보이지 않는 문자(태그 문자·보조 변형 선택자·폭 없는 공백·bidi 제어·제어 문자, `removeInvisibleCharacters`)를 지운다. 이모지 ZWJ·VS15/16·탭·줄바꿈은 남긴다.
- 사용자 원문은 `sanitizeForPrompt`(parse-todo, 500자)·`sanitizeMemoForPrompt`(5000자)가 NFKC 정규화(전각 `＜/task＞` → `</task>` 뒤 이스케이프) → 보이지 않는 문자 제거 → 계약 길이 자르기를 한다. 길이 초과 요청은 그 전에 `@aido/api` 요청 schema가 거절한다.
- 데이터 최소화: 프롬프트에는 요청한 사용자 본인의 할 일·카테고리·통계만 들어간다. 친구·댓글·공유 데이터, 비밀 값, 날씨(제안 v2)는 넣지 않는다. 제안 v2는 서버가 만든 후보와 응답 이력만, 리포트는 집계 수치와 카테고리 이름·이전 팁만 넣는다.
- 출력은 AI SDK `Output.object`(zod)로 받는다. zod object는 스키마 밖 필드를 버린다. 서버가 id·날짜·개수를 다시 정한다: 카테고리는 소유한 id만, 제안은 서버 후보 id와 기록된 요일만, 할 일 5개·항목 5개·팁 3개·길이 상한, 메모 `totalTaskCount`는 100개 상한. 제목·리포트 문장·제안 사유의 보이지 않는 문자도 지운다. 푸시 문구는 고정 copy라 모델 출력이 들어가지 않고, 앱은 모델 출력을 일반 텍스트로만 그린다(링크·Markdown 없음).
- 도구 호출(function calling)은 쓰지 않는다. 모델은 구조화 출력만 낸다.
- Gemini `safetySettings`는 괴롭힘·혐오·성적·위험 4종을 `BLOCK_ONLY_HIGH`로 둔다. 응답 후보가 safety로 막히면(`finishReason: content-filter`) `BLOCKED`(AI_1302)로 분류한다.
- 남용 방지: 파싱 endpoint는 사용자 기준 분당 parse-todo 20회·parse-memo 10회(`@ThrottleByUser`), 무료 월 한도·프리미엄 공정 사용 상한(`AiUsageGuard` + `QuotaLedger` 원자적 예약)을 공급자 호출 전에 적용한다. 작업별 `maxOutputTokens`·마지막 업체 `maxRetries`는 `ai-generation-policy.ts`, 체인 전체 제한 시간은 `AI_DEADLINE_<TASK>_MS`가 정한다.
- 개인정보: 로그는 위 관측 필드만 남긴다. `/ai/` 요청은 5xx Sentry 이벤트에 요청 본문을 붙이지 않는다(`httpIntegration`의 `ignoreRequestBody`).

## 버전과 호환

- 프롬프트를 크게 바꾸면 기능 폴더에 새 버전 폴더(`v1`, `v2`, …)를 만들고 이전 버전은 롤백용으로만 남긴다. 이전 버전 모듈에는 `@deprecated`와 제거 조건이 담긴 `TODO`를 단다.
- HTTP 경로는 `/v1/ai/*` 그대로다. 프롬프트 버전으로 API 버전을 올리지 않는다. 응답 변경은 `meta.promptVersion` 같은 optional 필드 추가만 한다([하위 호환](../conventions/compatibility.md)).
- live eval과 로그는 API 키·사용자 원문을 출력하지 않는다. 키는 환경 변수로만 읽고 결과 기록에는 모델·버전·건수·지연·실패 분류만 남긴다.

## 평가

- 결정 규칙 golden 26건과 흔들린 표현(relativeMinutes 0, 오늘 지난 때)(서울·LA 같은 순간)과 경계(자정·DST·윤일·월말·연말): `resolve-todo-schedule.spec.ts`.
- fake model golden: `apps/api/test/fixtures/ai-golden/parse-todo.{ko,en}.jsonl`을 `parse-todo.golden.spec.ts`가 실행한다.
- live eval(선택): 평가할 업체 키가 있을 때만 `AI_EVAL_PROVIDER=anthropic|google|openai pnpm --filter @aido/server ai:eval [추가 jsonl…]`(생략하면 `AI_PROVIDER_ORDER` 폴백 체인). 결과 요약에 추정 비용(`costMicroUsd`)을 함께 낸다. 날짜 필드 97%, 제목 90%, NO_ACTION 100% 미만이면 exit 1이다. 실제 유료 호출이므로 수동으로 실행하고 결과를 아래에 남긴다.

### 검증 기록

| 날짜       | 모델 / thinking                                    | 프롬프트 | 결과                                                                                                                                                                                                                                                     |
| ---------- | -------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-26 | 3.1-flash-lite / low·minimal, 3.5-flash(-lite) low | v2       | 169회. parse-todo 어려운 16건 전 구성 16/16. 긴 메모 3.1-lite low 3/5("다음 주 월요일"→OFFSET_WEEKS), minimal 0/5(totalTaskCount 과대). ko 리포트 "~요냥" 12건 중 9건, en 제안 러닝 후보 누락 6회 중 5회                                                 |
| 2026-10-26 | 3.1-flash-lite / todo minimal, 나머지 low          | v2.1     | 72회. parse-todo 38/38(p50 1297ms, p95 2059ms). 메모 9/9, 긴 메모 5/5(p50 5652ms). ko 리포트 "~요냥" 0/4, en 제안 러닝 선택 3/3, 제안 사유 서버 문장 대체 0/6. minimal 긴 메모 0/5는 그대로                                                              |
| 2026-10-26 | 3.1-flash-lite / low                               | v2.1     | 후속 38회. en 리포트 5/5·ko 3/3 숫자 근거 통과(근거 밖 숫자 문장 0), en 문장 "This is an increase of … compared to the previous period" 0/5. 긴 메모 count 정확: `totalTaskCount`를 앞에 둔 경우 5/10, 뒤로 옮긴 뒤 8/10. "은행 업무"류 덧붙인 명사 1/10 |
