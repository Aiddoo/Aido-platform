---
paths:
  - 'src/features/**/domains/**'
  - 'src/shared/domains/**'
---

# domains (모델)

- 모델은 Zod 클라이언트 모델(`xSchema` + `type X`)과 이름 있는 순수 함수, `XPolicy = { … } as const`로 이루어진다.
- 파일 하나에 엔티티 하나다(`{entity}.model.ts`).
- 함수와 Policy 메서드는 모듈 수준 함수이고 첫 인자가 모델 전체다. `this`와 클래스를 쓰지 않는다.
- 업무 규칙만 둔다: `can/should/is/has`(긍정형), `calculate`, `filterBy`/`orderBy`, `with`.
- 모델에 i18n 키, 색, 배치, 표시 방식을 두지 않는다. 표시 값은 `utils/*.view-model.ts`가 만든다. `constants/`도 import하지 않는다.
- 계약(`@aido/api` 요청·응답 타입)을 import하지 않는다. 바깥 값 변환은 `apis/{entity}.mapper.ts`가 한다.
- 의존해도 되는 것은 zod, `@aido/api/vocabulary`·`common`·`errors`, 순수 `shared/date`뿐이다.
- 시계를 읽지 않는다. `now`는 인자로 받는다. React도 import하지 않는다.
- "없음"은 `null`이다(`.nullable()`, `T | null`). 모델에 `.optional()`을 두지 않는다.
- 기능 오류는 `{feature}.error.ts` 하나에 둔다: 코드 표, `isXxxError`, `ErrorCode` → 폼 칸 매핑. `isApiError`·`hasCode`·`HttpStatus` 비교는 이 파일 안에서만 한다.
- 기간 규칙은 `shouldShow*(record, now)`로 두고 상수 이름에 단위를 넣는다(`PUSH_PROMPT_SNOOZE_DAYS`).
- 모델 테스트는 `{entity}.model.test.ts`에 경계값을 `it.each`와 fixture로 쓴다(형식은 [rules/tests](./tests.md)).

자세히: [모델](../../docs/architecture/model.md) · [오류](../../docs/error-handling.md) · [테스트](../../docs/testing.md)
