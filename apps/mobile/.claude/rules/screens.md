---
paths:
  - 'app/**'
---

# 화면 (app/)

규칙의 원본은 [스크린](../../docs/architecture/ui.md#스크린), [폼](../../docs/architecture/forms.md), [상태와 라우팅](../../docs/architecture/state-and-routing.md)이다. route 파일이 단계·경계·문구·`Spacing`·폼을 조립하고 그 화면만 쓰는 조각은 같은 파일의 지역 컴포넌트·훅이다. 컴포넌트·훅의 이동은 `useRouter()`다. 아래는 도구가 막는 것이다.

- `app/`에는 route 파일만 둔다. 화면 테스트는 `src/features/{feature}/__tests__/{route}-screen.test.tsx`다(ls-lint).
- route 파일은 `useRouteParamsOrRedirect`로 검증하고 틀리면 그 `redirect`만 그린다(`aido/route-params-guard`).
- `useLocalSearchParams` 결과를 구조 분해하지 않고 원시 setter를 꺼내지 않는다(`aido/no-destructured-search-params`·`aido/route-setter-location`).
- 세로 간격은 `<Spacing>`이고 여백 표기는 하나다(`aido/one-spacing-notation`·`aido/spacing-scale`).
- 중첩 삼항을 쓰지 않는다. 보기 분기는 `match(view).exhaustive()`다(`eslint/no-nested-ternary`).

전체 lint 목록은 [가드레일](../../docs/architecture/guardrails.md#규칙)이다.
