---
paths:
  - 'src/**/*.tsx'
---

# 컴포넌트

규칙의 원본은 [UI](../../docs/architecture/ui.md)다. 만들기 전에 [UI 카탈로그](../../docs/architecture/ui-catalog.md)·[훅](../../docs/architecture/hooks.md)에 같은 부품·훅이 있는지 본다. 입력은 `value`/`onChange`, `form`·`stepper`·바깥 여백을 받지 않는 것, fallback, 한 곳만 쓰면 지역에 두는 것은 [컴포넌트 계약](../../docs/architecture/ui.md#컴포넌트-계약)·[네임스페이스](../../docs/architecture/ui.md#네임스페이스지역-컴포넌트)다. 아래는 lint가 막는 것이다.

- 화면 id·search param을 Props로 내리지 않는다. route 튜플 훅으로 읽는다(댓글 기능은 `aido/no-route-id-props`).
- 위치 이름(`*Section`·`*Detail`·`*Content`·`*Panel` 등)을 쓰지 않는다(`aido/component-name`).
- 조각은 `X.Part = function Part`이고 로딩은 `X.Loading`이다(`aido/namespace-function-name`·`aido/namespace-part-name`, `Object.assign` 금지).
- 컴포넌트·훅은 모듈 수준 `function`이다(`aido/function-declaration`).
- className은 `cn`·`tv`로 조합한다(`aido/no-classname-concat`). 여백은 한 표기, Tailwind 단계, 임의 픽셀 없음(`aido/one-spacing-notation`·`aido/spacing-scale`·`aido/no-arbitrary-spacing-class`·`aido/spacing-props-with-classname`).
- 쿼리 결과는 `{ data: todo }`처럼 별칭을 붙인다(`aido/query-data-alias`). 훅 반환은 이름 있는 타입이다(`aido/no-return-type-of-hook`).
- 플랫폼 분기는 `process.env.EXPO_OS`다(`no-restricted-properties`).

전체 lint 목록은 [가드레일](../../docs/architecture/guardrails.md#규칙), 몸체·파일 순서는 [코드 배치](../../docs/architecture/ui.md#코드-배치), 색·글꼴은 [디자인](../../docs/design.md)이다.
