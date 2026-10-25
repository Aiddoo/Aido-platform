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

## 운영 설정 (env, 모두 선택)

| 키                         | 값                             | 기본                                   |
| -------------------------- | ------------------------------ | -------------------------------------- |
| `AI_MODEL_<TASK>`          | Gemini 모델 ID                 | `gemini-3.1-flash-lite`                |
| `AI_PROMPT_VERSION_<TASK>` | `v1` \| `v2`                   | `v2`                                   |
| `AI_THINKING_<TASK>`       | `minimal` \| `low` \| `medium` | `PARSE_TODO`는 `minimal`, 나머지 `low` |

`<TASK>`는 `PARSE_TODO`·`PARSE_MEMO`·`REPORT`·`SUGGESTION`이다. 기본값은 `platform/config/schemas/ai.schema.ts`에 있다. 2026-10-26 live eval에서 parse-todo는 `minimal`이 `low`와 정확도가 같고(어려운 16건 16/16) p50이 1725→1239ms로 짧아 `minimal`을 쓴다. parse-memo는 `minimal`에서 `totalTaskCount`를 과대 집계해(긴 메모 5/5, 프롬프트 v2.1 뒤에도 5/5) `low`를 유지한다. 리포트·제안은 야간 배치라 지연 이득이 작아 `low`를 유지한다. 작업별 토큰·시간·재시도 상한은 `application/services/parsing/ai-generation-policy.ts`에 있다.

## 오류·사용량

공급자 오류는 어댑터가 `AiProviderError` 종류로 분류한다(`RetryError`의 마지막 원인 포함). 파싱 응답 코드는 `RATE_LIMITED` → AI_1310, `UNAVAILABLE`·`UPSTREAM`·`TIMEOUT` → AI_1301, `BLOCKED`·`TRUNCATED`·`INVALID_OUTPUT` → AI_1302다. 실패와 모델 대상 명령만 있는 입력(NO_ACTION)은 사용량을 차감하지 않는다. 리포트는 일시 오류를 마지막 잡 시도 전까지 다시 던지고, 이후에만 폴백을 `contentSource = FALLBACK`으로 저장한다.

## 관측

모든 작업은 `ai.generation.completed`/`ai.generation.failed` 하나의 형식으로 남긴다: `task`, `promptVersion`, `model`, `latencyMs`, 입력·출력·사고 토큰, `finishReason`, `outcome`, `errorKind`, `quotaCharged`, `userId`. 사용자 원문·제목·카테고리 이름은 남기지 않는다.

## 평가

- 결정 규칙 golden 26건과 흔들린 표현(relativeMinutes 0, 오늘 지난 때)(서울·LA 같은 순간)과 경계(자정·DST·윤일·월말·연말): `resolve-todo-schedule.spec.ts`.
- fake model golden: `apps/api/test/fixtures/ai-golden/parse-todo.{ko,en}.jsonl`을 `parse-todo.golden.spec.ts`가 실행한다.
- live eval(선택): `GOOGLE_GENERATIVE_AI_API_KEY`가 있을 때만 `pnpm --filter @aido/server ai:eval [추가 jsonl…]`. 날짜 필드 97%, 제목 90%, NO_ACTION 100% 미만이면 exit 1이다. 실제 유료 호출이므로 수동으로 실행하고 결과를 아래에 남긴다.

### 검증 기록

| 날짜       | 모델 / thinking                                    | 프롬프트 | 결과                                                                                                                                                                                                                                                     |
| ---------- | -------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-26 | 3.1-flash-lite / low·minimal, 3.5-flash(-lite) low | v2       | 169회. parse-todo 어려운 16건 전 구성 16/16. 긴 메모 3.1-lite low 3/5("다음 주 월요일"→OFFSET_WEEKS), minimal 0/5(totalTaskCount 과대). ko 리포트 "~요냥" 12건 중 9건, en 제안 러닝 후보 누락 6회 중 5회                                                 |
| 2026-10-26 | 3.1-flash-lite / todo minimal, 나머지 low          | v2.1     | 72회. parse-todo 38/38(p50 1297ms, p95 2059ms). 메모 9/9, 긴 메모 5/5(p50 5652ms). ko 리포트 "~요냥" 0/4, en 제안 러닝 선택 3/3, 제안 사유 서버 문장 대체 0/6. minimal 긴 메모 0/5는 그대로                                                              |
| 2026-10-26 | 3.1-flash-lite / low                               | v2.1     | 후속 38회. en 리포트 5/5·ko 3/3 숫자 근거 통과(근거 밖 숫자 문장 0), en 문장 "This is an increase of … compared to the previous period" 0/5. 긴 메모 count 정확: `totalTaskCount`를 앞에 둔 경우 5/10, 뒤로 옮긴 뒤 8/10. "은행 업무"류 덧붙인 명사 1/10 |
