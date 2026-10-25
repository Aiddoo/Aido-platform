# AI 기능 (파싱·리포트·제안)

AI 작업의 프롬프트 버전·설정·평가를 바꿀 때 참고한다. 코드는 `apps/api/src/modules/ai-assistance`가 소유한다.

## 역할 분리

- LLM은 언어 해석만 한다. 파싱 v2의 모델 출력은 날짜가 아니라 일정 표현(`TodoDraft`)이고, 날짜·요일·시각은 순수 함수 `domain/services/parsing/resolve-todo-schedule.ts`가 사용자 시간대 기준으로 계산한다.
- 스키마는 세 단계다. LLM 스키마(관대, 길이·개수 제한 없음) → 서버 정규화 → `@aido/api` 공개 계약으로 최종 검증. 공개 계약은 optional `meta.promptVersion`과 parse-memo의 optional `meta.omittedTodoCount` 외에 바뀌지 않았다.
- parse-memo는 할 일을 합치지 않는다. 입력 순서대로 앞의 5개까지 만들고 나머지 수를 `meta.omittedTodoCount`로 알린다(메모 원문은 그대로 남는다). 서브투두도 합치지 않고 앞의 5개만 둔다.
- 리포트·제안도 서버가 근거 데이터를 만들고(기간 날짜·달성률 차이·후보 목록) 모델은 문장만 쓰거나 후보를 고른다.

## 프롬프트 버전

| 작업       | 폴더                                               | 버전 ID                          |
| ---------- | -------------------------------------------------- | -------------------------------- |
| parse-todo | `application/prompts/parsing/parse-todo/v1·v2`     | `parse-todo@v1`, `parse-todo@v2` |
| parse-memo | `application/prompts/parsing/parse-memo/v1·v2`     | `parse-memo@v1`, `parse-memo@v2` |
| report     | `application/prompts/reports/report/v1·v2`         | `report@v1`, `report@v2`         |
| suggestion | `application/prompts/suggestions/suggestion/v1·v2` | `suggestion@v1`, `suggestion@v2` |

- 기능 폴더의 `index.ts`가 버전별 정의(`promptVersion`·`build`·LLM schema+정규화)를 묶고, use case는 설정에 맞는 정의만 고른다.
- 두 파싱 v2가 함께 쓰는 규칙·LLM schema는 `parsing/shared/v2`, v1의 시간 규칙은 `parsing/shared/v1`에 있다.
- v1은 롤백용으로만 남기며 모든 v1 모듈은 `@deprecated`다. 제거 지점은 `TODO: 1.13.0 이전 앱 사용자가 업데이트한 뒤`로 검색한다.

## 운영 설정 (env, 모두 선택)

| 키                         | 값                             | 기본                    |
| -------------------------- | ------------------------------ | ----------------------- |
| `AI_MODEL_<TASK>`          | Gemini 모델 ID                 | `gemini-3.1-flash-lite` |
| `AI_PROMPT_VERSION_<TASK>` | `v1` \| `v2`                   | `v2`                    |
| `AI_THINKING_<TASK>`       | `minimal` \| `low` \| `medium` | `low`                   |

`<TASK>`는 `PARSE_TODO`·`PARSE_MEMO`·`REPORT`·`SUGGESTION`이다. `gemini-3.1-flash-lite`가 `minimal`을 지원하는지는 live로 확인하지 못해 기본값을 `low`로 둔다. 작업별 토큰·시간·재시도 상한은 `application/services/parsing/ai-generation-policy.ts`에 있다.

## 오류·사용량

공급자 오류는 어댑터가 `AiProviderError` 종류로 분류한다(`RetryError`의 마지막 원인 포함). 파싱 응답 코드는 `RATE_LIMITED` → AI_1310, `UNAVAILABLE`·`UPSTREAM`·`TIMEOUT` → AI_1301, `BLOCKED`·`TRUNCATED`·`INVALID_OUTPUT` → AI_1302다. 실패와 모델 대상 명령만 있는 입력(NO_ACTION)은 사용량을 차감하지 않는다. 리포트는 일시 오류를 마지막 잡 시도 전까지 다시 던지고, 이후에만 폴백을 `contentSource = FALLBACK`으로 저장한다.

## 관측

모든 작업은 `ai.generation.completed`/`ai.generation.failed` 하나의 형식으로 남긴다: `task`, `promptVersion`, `model`, `latencyMs`, 입력·출력·사고 토큰, `finishReason`, `outcome`, `errorKind`, `quotaCharged`, `userId`. 사용자 원문·제목·카테고리 이름은 남기지 않는다.

## 평가

- 결정 규칙 golden 26건(서울·LA 같은 순간)과 경계(자정·DST·윤일·월말·연말): `resolve-todo-schedule.spec.ts`.
- fake model golden: `apps/api/test/fixtures/ai-golden/parse-todo.{ko,en}.jsonl`을 `parse-todo.golden.spec.ts`가 실행한다.
- live eval(선택): `GOOGLE_GENERATIVE_AI_API_KEY`가 있을 때만 `pnpm --filter @aido/server ai:eval [추가 jsonl…]`. 날짜 필드 97%, 제목 90%, NO_ACTION 100% 미만이면 exit 1이다. 실제 유료 호출이므로 수동으로 실행하고 결과를 아래에 남긴다.

### 검증 기록

| 날짜 | 모델 | 프롬프트 | 결과                               |
| ---- | ---- | -------- | ---------------------------------- |
| -    | -    | -        | live eval 미실행 (2026-10-25 기준) |
