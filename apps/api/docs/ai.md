# AI 기능 (파싱·리포트·제안)

AI 작업의 프롬프트 버전·설정·평가를 바꿀 때 참고한다. 코드는 `apps/api/src/modules/ai-assistance`가 소유한다.

## 역할 분리

- LLM은 언어 해석만 한다. 파싱 v2의 모델 출력은 날짜가 아니라 일정 표현(`TodoDraft`)이고, 날짜·요일·시각은 순수 함수 `shared/domain/todo-schedule.domain-service.ts`(`resolveTodoSchedule`)가 사용자 시간대 기준으로 계산한다.
- 스키마는 세 단계다. LLM 스키마(관대, 길이·개수 제한 없음, 아래 업체 공통 규칙) → 서버 정규화 → `@aido/api` 공개 계약으로 최종 검증. 공개 계약은 optional 칸(`meta.promptVersion`, parse-memo의 `meta.omittedTodoCount`, `featureQuota`, `repeat`)만 더했다.
- 빠른 계획(`POST /v1/quick-plans`)·녹음 정리(`POST /v1/voice-notes/digest`) 응답에는 `meta`가 없다. 앱이 읽지 않는 업체·모델·토큰·프롬프트 버전을 내보내지 않고 서버 로그 `ai.generation.*`에만 남긴다. 출시 앱이 쓰는 `parse-todo`·`parse-memo`의 `meta`는 그대로다.
- parse-memo는 빠른 계획·녹음 정리와 같은 맥락(`planningContext`, 다가오는 할 일 30개)을 받아 겹침을 판정한다. 모델이 고른 id는 준 목록 안의 것만 남기고, 못 골랐으면 `findDuplicateTodoId`가 제목과 날짜로 다시 찾아 응답의 선택 칸 `duplicateOfTodoId`에 싣는다.
- parse-memo는 할 일을 합치지 않는다. 입력 순서대로 앞의 5개까지 만들고 나머지 수를 `meta.omittedTodoCount`로 알린다(메모 원문은 그대로 남는다). 서브투두도 합치지 않고 앞의 5개만 둔다.
- 긴 메모가 `maxOutputTokens`를 넘어 TRUNCATED가 되지 않도록 v2 모델은 할 일을 앞의 8개까지만 쓰고, 메모 전체 할 일 수를 LLM schema의 `totalTaskCount`(모르면 null)로 함께 낸다. `totalTaskCount`는 schema에서 `todos` 뒤에 둔다(앞에 두면 사고 토큰이 적은 응답에서 과대 집계가 잦았다). 남은 수는 `max(totalTaskCount, 받은 할 일 수) − 5`이고, 모델이 전체 수를 null로 두면 받은 할 일 수로 센다.
- 일정 계산은 사용자가 말한 날짜·시각을 우선한다. 날짜 없이 말한 때("아침에")가 오늘 이미 지났으면 다음 날 그 때로 넘기고, "오늘 아침"처럼 오늘을 말했는데 지났으면 오늘 종일로 둔다(지난 기본 시각을 만들지 않는다). 숫자 시각("오늘 오전 9시")은 지났어도 그대로 둔다. 상대 시각(`relativeMinutes`)은 1분 이상이고 날짜가 없거나 오늘일 때만 쓰며, 0이나 "내일"과 함께 온 값은 무시한다.
- 할 일에 지난 날짜는 쓸모없으므로 요일이 지났으면(토요일에 말한 "금요일", "이번 주 금요일") `weekOffset`과 무관하게 가장 가까운 앞으로의 그 요일로 넘긴다. "이번 달 초"(`MONTH_START` 0)는 1~10일이면 오늘, 11일부터 다음 달 1일이고, "올해 초"(`YEAR_START` 0)는 1월이면 오늘, 2월부터 내년 1월 1일이다(사용자 시간대 기준). 이번 달 이름을 말한 "M월 초"·"M월 말"은 모델이 `MONTH_START`·`MONTH_END` amount 0으로 내어 같게 계산하고, "M월 1일"처럼 정확한 날짜와 다른 달은 `CALENDAR_DATE`라 지났으면 내년이다. 음수 값과 연도까지 말한 지난 `CALENDAR_DATE`는 오늘로 두고 `INVALID_DATE`를 남긴다. 기간의 끝 요일이 시작보다 앞이면 시작 뒤의 그 요일이다.
- 리포트·제안도 서버가 근거 데이터를 만들고(기간 날짜·달성률 차이·후보 목록) 모델은 문장만 쓰거나 후보를 고른다. 리포트 정규화는 ko의 "~요냥"(해요체 뒤에 붙인 냥)과 en의 "meow"를 지운다(`reports/domain/report-persona.domain-service.ts`). 리포트 summary·팁에서 report_data에 없는 숫자를 쓴 문장은 빼고, 남는 summary나 팁이 없으면 폴백으로 저장한다. 제안 사유와 리포트 문장의 숫자는 서버 근거와 사용자가 쓴 이름의 분량("30개")만 허용하며 단위가 다르면 거른다(`shared/domain/grounded-numbers.domain-service.ts`).

## 프롬프트 구성

모든 작업은 `application/prompts/kit/prompt-definition.ts`의 `PromptDefinition<I, O, R, C>` 하나로 정의한다: `id`(AiTaskId), `version`(`<task>@<n>`), `schema`(Zod, 구조화 출력), `build(input, locale) → { system, prompt }`, `normalize(raw, ctx) → R`. use case는 `generateWithPrompt(generator, definition, built, ctx, { agreedConsentVersion })`로 부른다. 버전 폴더(v1·v2)와 `AI_PROMPT_VERSION_*` 전환은 없다.

| 작업              | 폴더                                 | 버전                   |
| ----------------- | ------------------------------------ | ---------------------- |
| parse-todo        | `prompts/parsing/parse-todo`         | `parse-todo@9`         |
| parse-memo        | `prompts/parsing/parse-memo`         | `parse-memo@9`         |
| report            | `prompts/reports/report`             | `report@3`             |
| suggestion        | `prompts/suggestions/suggestion`     | `suggestion@3`         |
| quick-plan        | `prompts/planning/quick-plan`        | `quick-plan@10`        |
| voice-note-digest | `prompts/planning/voice-note-digest` | `voice-note-digest@10` |

- 작업 폴더는 `prompt.ko.ts`·`prompt.en.ts`(고정 system), `examples.ko.ts`·`examples.en.ts`, `schema.ts`(LLM schema), `index.ts`(정의·입력 타입)다. 파싱·계획이 함께 쓰는 일정 표현 schema·규칙·기준 시각은 `prompts/parsing/schedule`, 계획 공통 규칙·맥락은 `prompts/planning`에 있다.
- 캐시 친화 순서: system은 `<role>` `<security>` `<language_policy>` `<output_contract>` `<rules>` `<examples>`(사용자 값 없음, 업체 어댑터가 Claude `cacheControl`을 건다) → user 턴은 동적 `<context>`(기준 시각·요일·시간대, 카테고리 id·이름, 계획은 다가오는 할 일 30개) → 맨 끝에 사용자 입력 블록(`<user_input>`·`<transcript>`·`<report_data>`·`<suggestion_data>`). 과제 지시는 `<output_contract>`에 있어 입력 뒤에 지시가 오지 않는다.
- `kit/security-rules.ts`: 데이터 블록·schema 출력 규칙 + 작업이 고르는 규칙(모델 대상 명령, 자기 계획 수정, 지어내기 금지, 목록에 있는 id만, 남에게 부탁은 내 할 일 "민지에게 회의록 요청", 군말·말 더듬기·받아쓰기 잡음 무시, 비슷하게 들린 고유명사는 `<context>` 표기로).
- 문맥 교정(`SPEECH_NOISE`·`PROPER_NOUNS`, quick-plan·voice-note-digest만): 받아쓰기가 소리가 비슷한 다른 단어로 적어 문맥에 맞지 않으면 맞는 단어로 고쳐 title에 쓴다("등기 보고서 정리" → "분기 보고서 정리"). 확실하지 않으면 들린 그대로 둔다. `<context>`의 카테고리·할 일 이름과 소리가 비슷하면 그 표기를 쓰고, 이 교정은 말한 그대로 쓰는 규칙보다 앞선다. golden은 `qp-ko-20`이다. 앱이 인식기에 주는 힌트(`apps/mobile/src/shared/infra/speech/speech-hints.ts`)는 인식 단계의 신호이고 서버는 모른다.
- `kit/language-policy.ts`: 할 일·하위 할 일·메모 제목은 말한 언어 그대로(섞인 "팀 standup 준비"도 그대로), 요약·핵심 포인트·정리 제목·이유는 앱 언어. 언어를 더하려면 이 표와 작업별 `examples.<locale>`을 더한다.
- 지시 문구나 정규화를 바꾸면 그 작업의 버전 숫자를 올린다. 관측 로그(`promptVersion`)와 `AiReport.promptVersion`으로 전후를 구분한다.

### 업체 공통 구조화 출력 규칙

세 업체가 같은 schema를 받도록 모든 LLM 출력 schema는 다음을 지킨다(`kit/prompt-schema-rules.spec.ts`가 `zodSchema(schema).jsonSchema`로 모든 정의를 검사한다).

- 모든 칸 required, 값이 없을 수 있는 칸은 `.nullable()`, `.optional()`·`.nullish()` 금지. 루트는 object이고 `$ref`·재귀·`oneOf`·`allOf`·`const`·`default`·`pattern`·min/max 계열은 쓰지 않는다. 범위·길이는 서버 정규화가 맞춘다. `z.number().int()`는 안전 정수 min/max를 실으므로 `llmInteger()`를 쓴다. 객체 유니온은 쓰지 않는다(`oneOf`·`const`가 되거나, `anyOf`여도 Claude JSON 도구가 배열을 문자열로 내보내다 JSON을 깨뜨린 사례가 있다). 종류가 다른 값은 칸을 나눈다.
- 없음은 모델 출력부터 도메인 IR(`todo-draft.types.ts`)까지 `null` 하나다. `?? undefined`로 되돌리지 않는다.
- 객체는 `kit/llm-object.ts`의 `llmObject`·`nullableLlmObject`로 만든다. 비엄격 경로에서 모델이 뺀 칸은 preprocess가 null로 채우고, 배열·객체 칸을 JSON 문자열로 보내면(Claude JSON 도구 실측 `{"actions":"[...]"}`) 풀어서 받는다. 문자열을 받는 칸은 건드리지 않고, 풀리지 않으면 원래 값을 schema가 거부한다. `preprocess(...).nullable()`처럼 바깥에 씌우면 Zod가 required에서 그 칸을 빼 OpenAI strict가 400을 내므로 null 허용은 안쪽에 두고, `.extend` 대신 shape을 펼쳐 조합한다.
- 업체 옵션: OpenAI `strictJsonSchema: true`와 `reasoningEffort` minimal→none, Google `structuredOutputs: true`, Claude `structuredOutputMode: "jsonTool"`(네이티브는 null 허용 칸 16개 제한, parse-todo는 29개)과 minimal이면 `thinking: disabled` + effort low.
- 프롬프트 문구·예시 JSON도 같은 규칙이다: "생략"이 아니라 "null"이고 예시는 모든 칸을 쓴다. golden의 `draft`는 빠진 칸을 그대로 둬도 schema가 null로 채운다.
- 출시 parse 응답이 나타내지 못하는 반복(격주·매월 등)은 `UNSUPPORTED`이고 할 일은 한 번만 만들어지므로 말한 요일·날짜를 `date`에 그대로 쓴다(golden `ko-16` "격주 화요일 스터디" → 다음 화요일).

### 계획(quick-plan·voice-note-digest) 출력

- 모델 출력은 `todos`(title, categoryId|null, date·endDate·time 일정 표현, repeat 표현, visibility `PRIVATE`|null, items, duplicateOfTodoId|null)와 `memo`(title, content 또는 null)다. 공개 계획 모양은 정규화(`NormalizedActionPlan`) 뒤에 만든다. 기한("금요일까지")은 date NONE + endDate, 반복의 요일·날짜는 daysOfWeek·monthDay에만 쓴다. 녹음 정리는 앱 언어의 title·summary·keyPoints(`{ text, sentenceIndex|null }`)를 더한다. 말한 언어가 달라도 이 셋은 앱 언어이고, 할 일 제목·항목과 메모만 말한 언어다. schema에서 title은 keyPoints 뒤에 둔다(앞에 두면 Claude가 말한 언어로 제목을 쓰는 일이 잦았다. 영어 앱·한국어 녹음 dg-mx-03 5회 중 5회 → 8회 중 0회). 모델은 날짜·시각을 계산하지 않고 표현만 낸다.
- 반복 표현: `DAILY`, `WEEKDAYS`, `WEEKENDS`, `WEEKLY_DAYS`(daysOfWeek), `BIWEEKLY_DAYS`(daysOfWeek, 격주), `MONTHLY_DAY`(monthDay 1~31), 기간형 `THIS_WEEK`·`NEXT_WEEK`·`WEEK_AFTER_NEXT`·`THIS_WEEKEND`·`NEXT_WEEKEND`·`THIS_WEEKDAYS`, 그 밖 `UNSUPPORTED`. 종료는 말했을 때만 `until`/`forDuration`이고 없으면 계속 반복(NEVER)이다. 시작일보다 뒤가 아닌 끝은 반복이 되지 않으므로 말하지 않은 것으로 보고 버린다(`REPEAT_END_NOT_AFTER_START`, 출시 앱용 `recurrence`는 기본 +4주). "30분 운동"처럼 한 번에 걸리는 시간은 제목에 남기고 반복 기간으로 쓰지 않는다. `WEEKENDS`는 "주말마다", "매주 주말", "weekends"처럼 되풀이를 말했을 때만이고, 그냥 "주말에"·"이번 주말"·"this weekend"(`THIS_WEEKEND`)와 "다음 주말"(`NEXT_WEEKEND`)은 계획에서 그 주말 토요일 한 번이다(`resolvePlanSchedule`, 일요일에 말한 이번 주말은 오늘). 출시 parse 응답의 `recurrence`와 `repeat`은 이 둘을 지금처럼 토·일 + 종료일로 준다(1.15 앱은 `voice-plan.mapper.ts`가 parse-memo의 이번 주말을 한 번으로 받는다). 출시 parse 응답(요일 + 종료일)은 격주·매월을 나타낼 수 없어 parse-todo schema는 이 둘을 받지 않고, resolver도 이 둘을 `UNSUPPORTED_RECURRENCE`로 다룬다.
- 정규화(`application/services/planning/action-plan.normalizer.ts`): 할 일 앞의 `ACTION_PLAN_LIMITS.MAX_TODOS`(10)개·메모 1개, 하위 항목 `TODO_ITEM_LIMITS.MAX_PER_TODO`, 제목 200자, 모르는 카테고리·겹침 id → null, 반복이면 기간(endDate)을 버린다. 핵심 포인트는 5개, 문장 번호는 준 문장 범위 안의 값만 남긴다. 계획·요약·핵심 포인트가 모두 비면 빈 결과(`isEmptyActionPlan`·`isEmptyVoiceNoteDigest`)로 호출부가 환불한다.

### 계획 생성과 적용(voice)

- `ai-assistance-planning.public.ts`의 `ActionPlanGeneratorPort`가 프롬프트·동의 범위·정규화·일정 계산을 맡고, 사용량·겹침 판정·저장은 `modules/voice`(slice `action-plans`·`voice-notes`)가 맡는다. 서버는 녹음도 전사 글자도 저장하지 않는다.
- 사용량: `ChargedPlanRunnerPort`가 호출 전 `reserve`, 차감 유지면 `commit`, 아니면 `refund`를 부른다. 빠른 계획은 결과가 할 일뿐이라 할 일이 있어야 차감하고 0개면 환불한다. 녹음 정리는 요약이나 핵심 내용도 결과이므로 할 일이 0개여도 VOICE_NOTE 1회를 확정(`charged: true`)하고, 실패·시간 초과·전 업체 장애와 요약·핵심 내용·계획이 모두 빈 결과(AI_1302)만 환불한다. 환불을 마친 실패만 `{ charged: false }`를 싣고, 환불에 실패하면 차감 여부를 말하지 않는다. 성공 응답의 `charged`는 실제 상태다. 확정을 저장하지 못하면 결과는 주되 `charged: false`(`ai.generation.commit-missed`)이고 그 예약은 정리 잡이 돌려준다. 확정 뒤 한도를 읽지 못하면 결과를 살리고 `featureQuota: null`이다. 이 흐름은 파싱과 계획 생성이 `settleChargedGeneration` 하나를 쓴다.
- 같은 `Idempotency-Key`: 처리 중이면 AI_1314, 내용(SHA-256 지문)이나 작업이 다르면 AI_1318, 확정된 요청은 AI를 부르지 않고 프로세스 메모리에 10분 둔 결과를 돌려준다. 결과를 Redis·DB에 두지 않으므로 재시작이나 10분 경과(FIFO 200건 초과 포함)로 결과를 잃으면 같은 행을 다시 열어(`reopen`, COMMITTED → RESERVED, 사용량은 그대로) AI를 다시 부른다. 추가 차감은 없다. 동시에 온 재요청은 AI_1314다. 다시 만들기가 실패하거나 빈 결과면 평소처럼 환불해 `{ charged: false }`다. 재생성 비용은 차감되지 않지만 사용자 일 예산(`AI_BUDGET_USER_DAILY_USD`)에 잡힌다. 성공 응답은 `charged: true`다(이번 호출로 더 차감하지 않았어도 이 요청의 차감 1회가 그대로다). 다시 만든 결과가 할 일 0개면(NO_ACTION) 환불해 `charged: false`다. 환불된 키(할 일 0개 NO_ACTION, 빈 결과 AI_1302, 실패)를 같은 키로 다시 보내면 같은 행에서 다시 차감하고 생성하므로 순 차감은 많아야 1회다. 그 사이 한도가 찼으면 차감 없이 AI_1303이다.
- 메모 나누기(`POST /v1/ai/parse-memo`)의 `Idempotency-Key`는 선택이다. 없으면(출시 앱) 요청마다 차감한다. 있으면 같은 원장 규칙(AI_1314·AI_1318, 추가 차감 없는 `reopen`)을 따르되, 메모 결과를 프로세스 메모리에 두지 않아 확정된 요청의 재시도도 AI를 다시 부른다.
- 녹음 길이: 앱이 보낸 `durationSeconds`가 등급별 `perUse.maxSeconds` + 30초를 넘으면 1.15.1은 거절하지 않고 운영 경보(`voice.note-digest.duration-over-limit`)만 올린다. 1.15.2부터 거절한다.
- 입력 상한: 녹음 글자 수(AI_1312)는 프롬프트에서 길어지는 글자(`<`·`>`·`&`·따옴표·줄바꿈)를 늘어난 길이로 세어 `maxInputChars`보다 먼저 막는다. 맥락의 카테고리는 `PLANNING_CATEGORY_LIMIT`(프리미엄 상한 30개)까지만 넣어 ADMIN도 상한 안에 들고, 저장된 제목의 이스케이프로 넘치면 겹침 후보를 뺀다.
- 적용: `POST /v1/action-plans/apply`는 AI를 부르지 않고 차감하지 않는다. 한 UoW에서 잠금 → 멱등 기록(`PlanApplication`) → 원본 메모·카테고리 소유 확인 → `StagedTodoCreatorPort.stage` → 원본 메모 삭제 → 새 메모 → 기록 순서이고 하나라도 실패하면 전부 되돌린다. 재요청은 만든 id로 다시 읽어 준다. 같은 키의 다른 요청이 먼저 기록을 남기면 저장소가 unique 위반을 처리 중(AI_1314)으로 바꾼다. 응답의 `todos`는 반복이면 첫 회차만이다. 기록은 7일 뒤 `voice-plan-application-cleanup.v1` 작업이 지운다.

## 운영 설정 (env, 키 외 모두 선택)

| 키                                                                      | 값                                            | 기본                                                        |
| ----------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------- |
| `ANTHROPIC_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` / `OPENAI_API_KEY` | 업체 키(빈 값은 미설정)                       | 없음 — 키가 있는 업체만 쓴다                                |
| `AI_PROVIDER_ORDER`                                                     | `anthropic,google,openai`의 부분 순서         | `anthropic,google,openai`                                   |
| `AI_MODEL_{ANTHROPIC,GOOGLE,OPENAI}`                                    | 모델 ID                                       | `claude-haiku-5-5` / `gemini-3.1-flash-lite` / `gpt-6-luna` |
| `AI_THINKING_<TASK>`                                                    | `minimal` \| `low` \| `medium`                | `PARSE_TODO`는 `minimal`, 나머지 `low`                      |
| `AI_DEADLINE_<TASK>_MS`                                                 | 업체 체인 전체 제한 시간                      | 12000 / 25000 / 60000 / 60000 / 24000 / 45000               |
| `AI_BREAKER_BILLING_COOLDOWN_MS`                                        | 결제·인증 실패 뒤 건너뛰는 시간               | 900000 (15분)                                               |
| `AI_BREAKER_HEALTH_THRESHOLD` / `_COOLDOWN_MS`                          | 연속 장애 횟수 / 건너뛰는 시간                | 5 / 30000                                                   |
| `AI_GENERATION_MODE`                                                    | 킬 스위치 `on` \| `interactive-only` \| `off` | `on`                                                        |
| `AI_BUDGET_DAILY_ALERT_USD` / `AI_BUDGET_MONTHLY_ALERT_USD`             | 추정 비용 경고 기준선(UTC 일·월)              | 1 / 10                                                      |
| `AI_BUDGET_DAILY_BACKGROUND_USD` / `AI_BUDGET_MONTHLY_BACKGROUND_USD`   | 리포트·제안 중단 기준선                       | 2 / 20                                                      |
| `AI_BUDGET_DAILY_USD` / `AI_BUDGET_MONTHLY_USD`                         | 전체 생성 중단 기준선                         | 3 / 30                                                      |
| `AI_BUDGET_USER_DAILY_USD`                                              | 사용자 한 명의 일 추정 비용 상한              | 0.25                                                        |

`<TASK>`는 `PARSE_TODO`·`PARSE_MEMO`·`REPORT`·`SUGGESTION`·`QUICK_PLAN`·`VOICE_NOTE_DIGEST`다. 기본값은 `platform/config/schemas/ai.schema.ts` 한 곳에 있고 `TypedConfigService.ai`가 업체·작업 단위로 묶어 한 번 파싱한다. 2026-10-26 live eval에서 parse-todo는 `minimal`이 `low`와 정확도가 같고(어려운 16건 16/16) p50이 1725→1239ms로 짧아 `minimal`을 쓴다. parse-memo는 `minimal`에서 `totalTaskCount`를 과대 집계해(긴 메모 5/5, 프롬프트 v2.1 뒤에도 5/5) `low`를 유지한다. 리포트·제안은 야간 배치라 지연 이득이 작아 `low`를 유지한다. 작업별 토큰 상한과 작업 분류(interactive·background)별 마지막 업체 SDK 재시도 수(1·0, 배경은 pg-boss가 다시 부른다)·요청당 모델 호출 상한(`maxModelCalls` 4·3)은 `generation/infrastructure/adapters/ai-generation-policy.constants.ts`에 있다. 킬 스위치·예산 env는 바꾸면 재시작해야 반영된다. Claude는 thinking을 `effort`(minimal·low → low, medium → medium)로, OpenAI는 `reasoningEffort`로, Gemini는 `thinkingLevel`로 보낸다.

## 업체 체인·폴백·회로

- Application은 `AiGeneratorPort.generate`(클래스 토큰) 하나만 안다(`generation/ai-assistance-generation.public.ts`). 구현 `AiSdkGeneratorAdapter`는 `ai-route.domain-service.ts`(순수 함수)로 업체 순서를 정한다: `AI_PROVIDER_ORDER` → 키가 있는 업체 → 사용자가 동의한 안내 버전이 허용한 업체(`ai-processor-consent.domain-service.ts`, 표는 `@aido/api/vocabulary`의 `AI_DATA_SHARING_CONSENT_PROVIDERS`) → 회로가 열린 업체 제외.
- 동의 버전: 2026-10-26(1.13·1.14 앱) 동의는 Google만, 2026-11-04(1.15) 동의는 Anthropic·Google·OpenAI를 쓴다. 동의 화면이 없던 1.13 미만 앱 요청(동의 버전 없음)은 그때 안내한 Google만 쓴다. 이전 버전 동의 사용자에게 다시 묻지 않는다. use case는 identity 동의 reader에서 동의한 버전을 읽어 `agreedConsentVersion`으로 넘긴다.
- 업체별 SDK 옵션과 오류 본문 해석은 `generation/infrastructure/adapters/{anthropic,google,openai}-provider.adapter.ts`(묶음 `AiProviderCatalog`) 안에만 있다. Claude 402 `billing_error`·400 `credit balance is too low`, OpenAI 429 `insufficient_quota`, Gemini 429의 선불 잔액 소진·지출 상한 문구와 400의 결제 문구는 `QUOTA_EXHAUSTED`다. Gemini 일반 429는 "check your plan and billing details"를 담아도 `RATE_LIMITED`다. 401/403·잘못된 키는 `AUTH`, Claude 529·503은 `OVERLOADED`, Gemini safety 400·OpenAI content policy·200 응답의 `refusal` 조각은 `BLOCKED`다. 기록된 오류 본문은 `apps/api/test/fixtures/providers/ai/<업체>/`에 있다.
- 앞 업체는 SDK 재시도 없이(`maxRetries: 0`) 바로 넘기고 마지막 업체만 작업 분류의 재시도 수를 쓴다. 재시도 층은 한 호출에 하나다(SDK `maxRetries`, 잡은 pg-boss). 대기열(bulkhead)을 지난 뒤부터 체인 전체에 작업별 제한 시간 하나(`AbortSignal.any`)를 걸고, 마지막이 아닌 업체는 남은 시간을 이번 업체와 아직 시도하지 않은 업체의 몫(`resolveAttemptTime`, OpenAI 2·나머지 1)대로 나눈 만큼만 기다린 뒤 `TIMEOUT`으로 다음 업체에 넘긴다. 몫의 기준은 어떤 순서로 모두 멈춰도 각 업체가 자기 작업의 2026-11 live eval 최댓값(parse-todo 36건·quick-plan 30건·digest 7건: Claude 2.3·4.9·5.0초, Gemini 1.8·4.9·6.8초, OpenAI 4.8·5.2·6.2초)의 1.2배 이상을 받는 것이다. 12·24·45초 체인에서 OpenAI는 6·12·22.5초, 나머지는 3·6·11.25초를 받는다. quick-plan을 15초로 두었을 때는 앞 업체 몫 3.75초를 Claude 30건 중 2건, Gemini 30건 중 6건이 넘어 폴백 비용이 늘었다. 체인 제한은 앱 요청 제한(`QUICK_PLAN_TIMEOUT_MS` 30초, `DIGEST_TIMEOUT_MS` 60초)보다 짧아야 앱이 먼저 끊지 않고 환불된 오류(`charged:false`)를 받는다. 한도 예약·저장과 대기열(bulkhead 대기는 체인 제한에 넣지 않는다) 시간을 남겨 quick-plan은 6초, digest는 15초 여유를 둔다. digest 평가 전사는 짧아(입력 2KB 안팎) 30분 녹음 지연은 재지 못했다. 몫이 모자라면 `AI_DEADLINE_VOICE_NOTE_DIGEST_MS`를 앱 제한 아래에서 늘린다. 앱이 응답 전에 연결을 끊으면(`@ClientAbortSignal`) 체인을 멈추고 `TIMEOUT`으로 끝나 예약을 환불한다. 앞 시도 때문에 몫의 90%도 받지 못한 업체의 `TIMEOUT`과 호출자가 끊은 시도는 그 업체 탓이 아니므로 장애 회로에 세지 않는다. 다만 시험 호출(half-open)에서는 어떤 오류든 실패로 봐 회로를 닫지 않는다. 스키마 불일치(`INVALID_OUTPUT`)는 첫 업체에만 한 번 더 묻고, `BLOCKED`·`TRUNCATED`(본문 없이 출력 상한으로 끝난 응답 포함)는 다른 업체도 같게 실패하므로 넘기지 않는다. 결제·인증 실패는 SDK 재시도에서도 뺀다(`withoutRetryOnBillingFailure`). 요청당 모델 호출은 `maxModelCalls`를 넘지 않는다.
- 회로: 공용 `OutboundPolicy`(`platform/resilience`, cockatiel, 프로세스 메모리 — 단일 컨테이너) 위에 업체별 얇은 spec(`ai-provider-outbound.policy.ts`, 이름 `ai:anthropic`·`ai:google`·`ai:openai`)을 둔다. 결제 회로는 `QUOTA_EXHAUSTED` 한 번에, 인증 회로는 `AUTH` 연속 3번에 열고 15분 뒤 시험 호출, 장애 회로는 `OVERLOADED`·`UPSTREAM`·`TIMEOUT` 연속 5번에 30초 연다. 시험 호출이 진행 중인 업체는 열린 회로처럼 건너뛰고 기다리지 않는다. 결제 회로가 열리면 운영 경보 포트(`OperationalAlertPort.raise`, key `ai.provider.billing-circuit-opened`, Sentry fingerprint = key, 태그 policy·breaker·reason·task)로 "Claude 결제·인증 실패, 다음 순서 AI 업체로 전환" 이슈를 남긴다.
- 동시성: 작업 분류별 bulkhead `ai:interactive`(동시 8·대기 16)·`ai:background`(동시 2·대기 200). 대기열이 가득 차면 업체를 부르지 않고 `RATE_LIMITED`(AI_1310)다. 같은 사용자·작업·프롬프트 버전·지시·입력의 요청이 동시에 오면(sha256 키) 업체 호출 하나를 나눠 쓴다. 결과 저장형 캐시는 두지 않는다("내일"처럼 시점에 따라 답이 달라진다).

### 업체 데이터 처리

업체마다 `AiProviderAdapter.dataHandling`(`trainsOnUserData`·`disablesResponseStorage`·`basis`)으로 선언하고 앱 개인정보 문구(국외 이전)와 맞춘다. 셋 다 학습에 쓰지 않는다(`trainsOnUserData: false`). 보관을 끄는 옵션은 OpenAI에만 있어 그 어댑터만 `store: false`를 보낸다.

| 업체      | 학습  | 응답 보관 끄기        | 근거                                               |
| --------- | ----- | --------------------- | -------------------------------------------------- |
| Anthropic | 안 함 | 옵션 없음(API 기본값) | API 상업 약관 기본값: 입력·출력을 학습에 쓰지 않음 |
| Google    | 안 함 | 옵션 없음             | Gemini API 유료 등급 키: 제품 개선(학습)에 안 씀   |
| OpenAI    | 안 함 | `store: false`        | API 기본값: 학습에 쓰지 않음, 응답 저장도 끈다     |

Sentry AI span에는 입력·지시·응답 문장을 싣지 않는다([보안](security.md#ai)).

### 입력 상한·킬 스위치·비용 예산

- 모든 작업은 `AiSdkGenerator.generate` 맨 앞을 지난다. 순서: user 턴 글자 수 > `maxInputChars`면 업체 호출 없이 `BAD_REQUEST`(AI_1302) + `ai.generation.input-rejected` error 로그 → 킬 스위치·예산 판단(`domain/policies/generation/ai-spend.policy.ts` `decideAiSpend`) → 합치기 → bulkhead → 업체 체인. 요청은 `taskClass`·`userId`·`maxInputChars`를 싣는다. 분류와 입력 상한은 `PromptDefinition`이 정하고 `generateWithPrompt(…, { agreedConsentVersion, userId })`가 채운다.
- `maxInputChars`(user 턴, 계약 길이·맥락 상한 최대치 실측에 여유): parse-todo 5,000(최대 약 3,700) · parse-memo 15,000(약 13,800) · quick-plan 12,000(약 9,800) · voice-note-digest 100,000(40,000자 전사를 문장 600개로 나눈 최대 약 94,000) · report·suggestion 16,000.
- 킬 스위치 `AI_GENERATION_MODE`: `off`면 모든 생성, `interactive-only`면 리포트·제안만 `HALTED`(AI_1301)로 멈춘다.
- 예산: 추정 비용(micro-USD)을 `OutboundUsage`(meter `ai.spend`, subject `*`·사용자 id, UTC 일 `2026-11-05`·월 `2026-11`)에 요청이 끝날 때 전역 일·전역 월·사용자 일 세 행으로 한 번 더한다(`ai-spend-budget.adapter.ts`). 판단은 메모리 스냅샷(재시작·날짜가 바뀌면 DB에서 다시 읽음, 사용자 1만 명 LRU)으로 한다. 전역 일 $3·월 $30 이상이면 전부, 배경 작업은 일 $2·월 $20 이상이면 `HALTED`, 사용자 일 $0.25 이상이면 `USER_SPEND_LIMITED`(AI_1310)다. 사용자 일 예산은 요금제·역할과 무관하게 모두 같고(ADMIN도 프리미엄과 같은 예산이다. 사용자 비용 예산은 access 횟수 한도와 다른 상한이다) 사용량 기록·전역 예산·킬 스위치·입력 상한도 같다. 사용자 행은 계정 영구 삭제 때 함께 지운다. 진행 중인 호출은 끝난 뒤 더해지므로 상한은 그만큼 넘을 수 있다. 경고·배경·중단 기준선을 처음 넘긴 요청 하나가 기간당 한 번 `ai.spend.threshold-reached` 경보를 올린다(원자적 누적값 비교). 계량 오류는 로그만 남기고 생성을 막지 않는다.
- 추정 비용은 보수적이다: 단가를 모르는 모델은 최고 단가로 `maxOutputTokens`까지 쓴 것으로, 사용량 없이 시간 초과로 끝난 호출은 입력 글자 수를 토큰 수로 보고 입력 비용을 더한다. 응답·로그의 `estimatedCostMicroUsd`는 지금처럼 토큰 기준(모르면 null)이다.
- 사용자 요청의 `HALTED`·`USER_SPEND_LIMITED`도 다른 실패처럼 예약을 환불하고 `{ charged: false }`를 싣는다. 리포트·제안은 `isWithheldAiFailure`(UNAVAILABLE·HALTED·USER_SPEND_LIMITED)를 업체 없음처럼 다룬다(리포트 템플릿, 제안 건너뜀, 잡 재시도 없음). 회로가 열려 지금만 부를 수 없는 `CIRCUIT_OPEN`은 일시 실패라 잡이 다시 시도한다.
- 장치가 있을 때 비용 범위: 월 ≤ $30, 일 ≤ $3(+진행 중 호출분), 사용자당 일 ≤ $0.25.
- 비용: `AI_MODEL_PRICING`(1M 토큰당 입력/캐시 읽기/캐시 쓰기/출력: claude-haiku-5-5 $0.10/$0.01/$0.125/$0.50, gemini-3.1-flash-lite $0.25/$0.025/입력 단가/$1.50, gpt-6-luna $0.10/$0.01/$0.125/$0.50, 공식 가격표 2026-11-05)으로 모든 시도의 토큰을 더해 `estimatedCostMicroUsd`를 낸다. 단가를 모르는 모델로 바꾸면 null이다. OpenAI는 `store: false`로 응답을 저장하지 않는다. Claude는 Haiku 5.5 최소 캐시 길이 512토큰 기준으로 512자 이상 고정 지시문 끝에 `cacheControl`을 붙이고(JSON 도구 schema와 고정 system이 함께 캐시되고 날짜·카테고리는 그 뒤 user 턴에 있다) Gemini·OpenAI는 업체 자동 캐시를 쓴다. 입력 토큰 중 캐시 읽기·쓰기(`cachedInputTokens`·`cacheWriteInputTokens`)는 각 단가로 계산한다.

## 오류·사용량

생성 실패 종류와 처리는 `generation/application/ai-generation.errors.ts`의 표 하나가 정한다.

| 종류                                      | 폴백                    | 회로    | 응답    |
| ----------------------------------------- | ----------------------- | ------- | ------- |
| QUOTA_EXHAUSTED(1회에 열림)               | 예                      | billing | AI_1301 |
| AUTH(연속 3회에 열림)                     | 예                      | auth    | AI_1301 |
| RATE_LIMITED                              | 예                      | -       | AI_1310 |
| OVERLOADED · UPSTREAM(404 포함) · TIMEOUT | 예                      | health  | AI_1301 |
| BAD_REQUEST(404 제외 4xx)                 | 예(error 로그)          | -       | AI_1302 |
| BLOCKED · TRUNCATED                       | 아니오                  | -       | AI_1302 |
| INVALID_OUTPUT                            | 업체당 1회 재질문 뒤 예 | -       | AI_1302 |
| UNAVAILABLE(키·동의 범위 밖)              | -                       | -       | AI_1301 |
| CIRCUIT_OPEN(회로가 모두 열림)            | -                       | -       | AI_1301 |
| HALTED(킬 스위치·전역 예산)               | 아니오                  | -       | AI_1301 |
| USER_SPEND_LIMITED(사용자 예산)           | 아니오                  | -       | AI_1310 |

끝내 실패하면 마지막 시도의 종류로 응답한다. 사용자 요청의 AI_1301·AI_1302·AI_1310은 예약을 환불한 뒤 던지므로 공개 상세 `{ charged: false }`를 싣는다(앱 문구 "횟수는 차감되지 않았어요"). 환불이 저장되지 않으면 차감 여부를 보장할 수 없으므로 상세 없이 같은 코드만 준다. 실패와 모델 대상 명령만 있는 입력(NO_ACTION)은 사용량을 차감하지 않는다. 사용량은 Access의 `QuotaLedger`가 센다: 공급자 호출 전에 `reserve`(한도 초과 AI_1303, 녹음 정리 AI_1313, 같은 키 처리 중 AI_1314 — 모두 `details: { charged: false, featureQuota }`), 결과를 주면 `commit`, 실패는 `refund(FAILED)`, NO_ACTION은 `refund(NO_ACTION)`이고 환불은 정확히 한 번이다. 요청(같은 키의 재예약·재생성은 한 줄)마다 `QuotaCharge` 한 줄이 남아 고객 문의 때 최종 상태와 시도 수(`attempt`)로 차감·환불을 설명한다. 재예약이 같은 행을 덮어쓰므로 시도별 이력은 로그(`access.quota.*`, `chargeId`)로 본다. 성공 응답은 갱신된 `featureQuota`를 함께 준다. 확정 뒤 한도를 읽지 못하면 결과를 살리고 `featureQuota`만 뺀다(`ai.generation.quota-read-failed`). 프로세스가 죽어 끝나지 못한 RESERVED는 10분 주기 `quota-abandoned-refund.v1` 잡이 `QUOTA_RESERVATION_TAKEOVER_AFTER_MS`(2분)가 지난 것만 `refundReason = ABANDONED`로 돌려준다(사용자 행 잠금 + 조건부 갱신이라 멱등). 30분 넘게 남은 예약이 있거나 돌려주지 못하면 `access.quota.stale-reservation` 경보를 올린다. 같은 잡이 7일 지난 `requestHash`를 지운다. 리포트는 일시 실패(`RATE_LIMITED`·`OVERLOADED`·`UPSTREAM`·`TIMEOUT`)를 마지막 잡 시도 전까지 다시 던지고, 이후에만 폴백을 `contentSource = FALLBACK`으로 저장한다. 제안 잡도 일시 실패만 다시 던지고 출력 오류·차단·잘림은 같은 비용으로 같게 실패하므로 건너뛴다. 보낼 업체가 없거나 킬 스위치·예산으로 멈추면 리포트는 폴백을 저장하고 제안은 건너뛴다.

## 관측

모든 작업은 `ai.generation.completed`/`ai.generation.failed` 하나의 형식으로 남긴다: `task`, `promptVersion`, `provider`, `model`, `attempts`, `fallbackFrom`, `estimatedCostMicroUsd`, `latencyMs`, 입력·캐시 읽기·캐시 쓰기·출력·사고 토큰, `finishReason`, `outcome`, `errorType`(공급자 실패 분류), 파싱 응답 `errorCode`, `statusCode`, `quotaCharged`, `userId`. 공급자 실패는 `upstream`(`errorType` = 오류 이름, `statusCode`, 오류 본문의 `providerStatus` 예: `UNAVAILABLE`·`billing_error`, 네트워크 `networkCode` 예: `ECONNRESET`)으로 원인을 남긴다. 업체 경계에서는 `ai.provider.fallback`(task·from·to·errorType·statusCode)과 공용 정책의 `outbound.circuit.{opened,half-open,closed}`(policy `ai:<업체>`·breaker·reason·task)·`outbound.bulkhead.rejected`(policy)를 남긴다. 방어선은 `ai.generation.input-rejected`(task·inputChars·maxInputChars), `ai.spend.halted`(task·taskClass·reason), `ai.spend.user-limited`(task·userId), `ai.spend.threshold-reached`(tier·window·period·totalMicroUsd·limitMicroUsd)다. parse-memo의 `ai.generation.completed`는 모델이 낸 날짜 표현 `dateRefs`(`kind`·`weekOffset`)를 더한다. 고정 기호만 담고 공급자 message·응답 본문·사용자 원문·제목·카테고리 이름은 남기지 않는다.

## 프롬프트 보안

- 지시는 AI SDK `instructions`(system)에만 둔다. system은 서버 상수이고 사용자·저장 데이터는 user 턴의 데이터 블록(`<user_input>`·`<context>`·`<report_data>`·`<suggestion_data>`)에만 들어간다. 각 system의 `<security>`·`<grounding>`이 블록 안 문자열을 데이터로 다루라고 명시한다.
- 데이터 블록은 모두 `generation/application/messages/untrusted-input.messages.ts`의 `wrapUntrusted`(내부 `encodeUntrustedJson`)로 만든다. JSON 문자열로 넣고 `<`·`>`·`&`를 이스케이프해 태그를 닫거나 열 수 없고, 모든 문자열 값에서 보이지 않는 문자(태그 문자·보조 변형 선택자·폭 없는 공백·bidi 제어·제어 문자, `removeInvisibleCharacters`)를 지운다. 이모지 ZWJ·VS15/16·탭·줄바꿈은 남긴다.
- 사용자 원문은 `sanitizeLineForPrompt`(parse-todo 500자·빠른 계획 1000자·전사 문장)·`sanitizeTextForPrompt`(메모 5000자·문장 없는 전사)가 NFKC 정규화(전각 `＜/task＞` → `</task>` 뒤 이스케이프) → 보이지 않는 문자 제거 → 계약 길이 자르기를 한다. 길이 초과 요청은 그 전에 `@aido/api` 요청 schema가 거절한다.
- 데이터 최소화: 프롬프트에는 요청한 사용자 본인의 할 일·카테고리·통계만 들어간다. 친구·댓글·공유 데이터, 비밀 값, 날씨(제안 v2)는 넣지 않는다. 제안 v2는 서버가 만든 후보와 응답 이력만, 리포트는 집계 수치와 카테고리 이름·이전 팁만 넣는다.
- 출력은 AI SDK `Output.object`(zod)로 받는다. zod object는 스키마 밖 필드를 버린다. 서버가 id·날짜·개수를 다시 정한다: 카테고리는 소유한 id만, 제안은 서버 후보 id와 기록된 요일만, 할 일 5개·항목 5개·팁 3개·길이 상한, 메모 `totalTaskCount`는 100개 상한. 제목·리포트 문장·제안 사유의 보이지 않는 문자도 지운다. 푸시 문구는 고정 copy라 모델 출력이 들어가지 않고, 앱은 모델 출력을 일반 텍스트로만 그린다(링크·Markdown 없음).
- 도구 호출(function calling)은 쓰지 않는다. 모델은 구조화 출력만 낸다.
- Gemini `safetySettings`는 괴롭힘·혐오·성적·위험 4종을 `BLOCK_ONLY_HIGH`로 둔다. 응답 후보가 safety로 막히면(`finishReason: content-filter`) `BLOCKED`(AI_1302)로 분류한다.
- 남용 방지: 파싱 endpoint는 사용자 기준 분당 parse-todo 20회·parse-memo 10회(`@ThrottleByUser`), 무료 월 한도·프리미엄 공정 사용 상한(동의 guard 뒤 access `@RequireQuota("AI_PLAN")` 선검사 + `QuotaLedger` 원자적 예약)을 공급자 호출 전에 적용한다. 작업별 `maxOutputTokens`·분류별 `maxRetries`·`maxModelCalls`는 `ai-generation-policy.constants.ts`, 입력 상한은 `PromptDefinition.maxInputChars`, 체인 전체 제한 시간은 `AI_DEADLINE_<TASK>_MS`, 비용 상한은 `AI_BUDGET_*`가 정한다.
- 개인정보: 로그는 위 관측 필드만 남긴다. `/ai/` 요청은 5xx Sentry 이벤트에 요청 본문을 붙이지 않는다(`httpIntegration`의 `ignoreRequestBody`).

## 버전과 호환

- 프롬프트를 바꾸면 같은 폴더에서 고치고 정의의 `version` 숫자를 올린다. 이전 버전 폴더·env 전환은 두지 않는다(되돌리기는 배포 롤백). 출시 응답의 `meta.promptVersion`은 선택 문자열이라 값이 바뀌어도 호환된다.
- HTTP 경로는 `/v1/ai/*` 그대로다. 프롬프트 버전으로 API 버전을 올리지 않는다. 응답 변경은 `meta.promptVersion` 같은 optional 필드 추가만 한다([하위 호환](../../../docs/conventions/compatibility.md)).
- live eval과 로그는 API 키·사용자 원문을 출력하지 않는다. 키는 환경 변수로만 읽고 결과 기록에는 모델·버전·건수·지연·실패 분류만 남긴다.

## 평가

- 결정 규칙 golden 26건과 흔들린 표현(relativeMinutes 0, 오늘 지난 때)(서울·LA 같은 순간)과 경계(자정·DST·윤일·월말·연말): `todo-schedule.domain-service.spec.ts`.
- golden 데이터: `apps/api/test/fixtures/ai-golden/{parse-todo,parse-memo,quick-plan,voice-note-digest}.{ko,en,mixed}.jsonl`(로더 `golden-cases.ts`). 받아쓰기 오류(띄어쓰기 없음·동음이의·"음 그러니까"·`<context>`로 고칠 고유명사), 반복 종류 전부·종료 날짜·계속 반복, 기간, 하위 항목, 비공개, 종일·시각, 한영 혼합 제목, 남에게 부탁, 전사 안 지시 주입, 다가오는 할 일·진행 중 반복과의 겹침을 담는다. 계획 기대값은 일정 표현을 resolver로 계산한 날짜라 같은 뜻의 다른 표현도 같게 비교된다.
- fake model golden: `parse-todo-golden.use-case.spec.ts`·`parse-memo-golden.use-case.spec.ts`(공개 응답), `action-plan-golden.messages.spec.ts`(계획 정규화·핵심 포인트 문장 번호·중요 표시 포함)가 모든 줄을 schema로 읽고 실행한다.
- live eval(수동, CI·hook 제외): `pnpm --filter @aido/server ai:eval --task parse-todo|parse-memo|quick-plan|voice-note-digest --provider anthropic|google|openai [추가 jsonl…]`(`--provider를 빼면 `AI_PROVIDER_ORDER` 폴백 체인). 키는 운영과 같은 env에서 읽고, 고른 업체 키가 없으면 호출 없이 exit 0이다. 날짜 0.97·제목 0.9·겹침 판정 0.9(계획)·NO_ACTION 1(parse-todo) 미만이면 exit 1이고, 요약에 캐시 토큰(`tokens.cached`·`tokens.cacheWrite`)과 캐시 단가를 반영한 추정 비용(`estimatedCostMicroUsd`)·지연(p50·p95·max)·녹음 정리의 중요 표시 반영률(`bookmarkRecall`)·앱 언어 작성률(`digestInAppLanguage`, 지표만)을 함께 낸다. 제목 비교는 영어 관사·소유격(a·an·the·my) 유무를 같게 본다. 콘솔에는 case id·지표·토큰(cached·cacheWrite 포함)만 쓰고 입력·전사·키는 쓰지 않는다. 실제 유료 호출이므로 결과를 아래에 남긴다.

### 검증 기록

| 날짜       | 모델 / thinking                                                 | 프롬프트                                        | 결과                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------- | --------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-26 | 3.1-flash-lite / low·minimal, 3.5-flash(-lite) low              | v2                                              | 169회. parse-todo 어려운 16건 전 구성 16/16. 긴 메모 3.1-lite low 3/5("다음 주 월요일"→OFFSET_WEEKS), minimal 0/5(totalTaskCount 과대). ko 리포트 "~요냥" 12건 중 9건, en 제안 러닝 후보 누락 6회 중 5회                                                                                                                                                                                                                                                   |
| 2026-10-26 | 3.1-flash-lite / todo minimal, 나머지 low                       | v2.1                                            | 72회. parse-todo 38/38(p50 1297ms, p95 2059ms). 메모 9/9, 긴 메모 5/5(p50 5652ms). ko 리포트 "~요냥" 0/4, en 제안 러닝 선택 3/3, 제안 사유 서버 문장 대체 0/6. minimal 긴 메모 0/5는 그대로                                                                                                                                                                                                                                                                |
| 2026-10-26 | 3.1-flash-lite / low                                            | v2.1                                            | 후속 38회. en 리포트 5/5·ko 3/3 숫자 근거 통과(근거 밖 숫자 문장 0), en 문장 "This is an increase of … compared to the previous period" 0/5. 긴 메모 count 정확: `totalTaskCount`를 앞에 둔 경우 5/10, 뒤로 옮긴 뒤 8/10. "은행 업무"류 덧붙인 명사 1/10                                                                                                                                                                                                   |
| 2026-11-06 | claude-haiku-5-5 1순위(`anthropic,openai,google`) / 작업별 기본 | parse-todo@7, quick-plan@8, voice-note-digest@8 | parse-todo 36건 날짜·제목·NO_ACTION 1.0(p50 1469ms, p95 1884ms). quick-plan 42건(추가 사례 3건 포함) 날짜·제목·겹침 0.976(p50 1372ms, 실패 qp-mx-04 "Call 엄마"→"엄마에게 전화하기"). digest 9건 날짜 0.889(실패 dg-mx-02 "그 전에 견적서 보내기"를 오늘로 읽음, 10회 중 3회). 제목 언어 dg-mx-03 5/5 실패 → 8회 중 0회. 대상 사례 gpt-6-luna quick-plan 8/9·digest 1/3, gemini-3.1-flash-lite quick-plan 7/9("등기 보고서" 유지 등)·digest 3/3. 총 $0.107 |
| 2026-11-06 | claude-haiku-5-5 / 작업별 기본                                  | voice-note-digest@8                             | `dg-mx-02` 문장을 "내일 미팅 전에 견적서 보내기"로 바꾼 뒤 3회 재평가. 날짜·제목·겹침·중요 표시 3/3(p50 2589~3516ms). 앱 언어 지표 1/3은 요약에 쓴 "김 대리" 한글 때문이고 합격 기준이 아니다. 총 $0.0025                                                                                                                                                                                                                                                  |

## 전환 중

ai-assistance는 slice 구조로 옮겼다(`architecture.ratchet.json`). 남은 것: 리포트 큐는 아직 `JobRuntimePort`(defineQueue 전), parse-todo·parse-memo의 application 다섯 파일은 정리 결과를 공개 계약(`parsedTodoDataSchema`)으로 검증해 줄 단위 lint 예외가 있다(ParsedTodo read model로 옮길 때 지운다). voice가 클래스 토큰으로 옮길 때까지 옛 Symbol 토큰(`USER_LOCALE_PREFERENCE_READER`·`ACTION_PLAN_GENERATOR`)과 parsing 공개 문의 옛 함수 별칭을 둔다.
