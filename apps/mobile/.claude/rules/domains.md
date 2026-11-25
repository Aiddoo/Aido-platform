---
paths:
  - 'src/features/**/domains/**'
  - 'src/shared/domains/**'
---

# domains (모델)

- 모델은 Zod 클라이언트 모델(`xSchema` + `type X`), 원시 인자 순수 함수, `XPolicy = { method(x) { … } }`로 이루어진다.
- 파일 하나에 엔티티 하나, Policy 하나다(`{entity}.model.ts`). 파일·타입·Policy는 같은 엔티티 이름이다.
- Policy는 메서드 객체이고 첫 인자는 그 파일이 선언한 모델 전체다(`aido/policy-facade`, `aido/policy-model-parameter`). 메서드끼리는 `this`로 부르고, 메서드는 값으로 넘기지 않고 화살표로 감싼다(`aido/no-unbound-policy-method`). 모델을 첫 인자로 받는 함수를 낱개로 export하지 않는다(`aido/model-function-exports`).
- 업무 규칙만 둔다: `can/should/is/has`(긍정형), `calculate`, `filterBy`/`orderBy`, `with`.
- 모델에 i18n 키, 색, 배치, 표시 방식, 폴링·재시도 주기를 두지 않는다. 표시 값은 `utils/*.view-model.ts`, 주기는 `queries/`·세션의 지역 표다.
- 계약(`@aido/api` 요청·응답 타입)을 import하지 않는다. 바깥 값 변환은 `apis/{entity}.mapper.ts`가 한다.
- 의존해도 되는 것은 zod, `@aido/api/vocabulary`·`common`·`errors`, 순수 `shared/date`, `shared/constants/time-units`, 다른 모델뿐이다. `core/ports`·`schemas/`·`constants/`·계약은 import하지 않는다.
- 시계를 읽지 않는다. `now`는 인자로 받는다. React도 import하지 않는다.
- "없음"은 `null`이다(`.nullable()`, `T | null`). 모델에 `.optional()`을 두지 않는다.
- 기능 오류는 `{feature}.error.ts` 하나에 둔다: 코드 표, `isXxxError`, `ErrorCode` → 폼 칸 매핑. `isApiError`·`hasCode`·`HttpStatus` 비교는 이 파일 안에서만 한다.
- 기간 규칙은 `shouldShow*(record, now)`로 두고 상수 이름에 단위를 넣는다(`PUSH_PROMPT_SNOOZE_DAYS`).
- 모델 테스트는 `{entity}.model.test.ts`에 경계값을 `it.each`와 fixture로 쓴다. `describe(함수)`와 `describe(Policy)` > `describe(메서드)`로 묶는다(형식은 [rules/tests](./tests.md)).

자세히: [모델](../../docs/architecture/model.md) · [오류](../../docs/error-handling.md) · [테스트](../../docs/testing.md)
