---
paths:
  - 'app/**'
---

# 화면 (app/)

- `app/`에는 route 파일만 둔다. 테스트·fixture·도구를 두지 않는다(화면 테스트는 `src/features/{feature}/__tests__/{route}-screen.test.tsx`).
- 화면은 위에서 아래로 읽힌다. 배치·간격·경계·화면 문구·`match(view)`만 맡고 데이터 변환, 긴 effect, 폼 제출은 컴포넌트·훅에 둔다.
- 오류 경계와 `Suspense`, `<Spacing>`은 화면에서 둔다. 대부분 안 보이는 블록만 `fallback={null}`과 이유 주석을 쓴다.
- 세로 간격은 `<Spacing>`만 쓰고 위아래에 빈 줄을 둔다. 블록에 `mb`/`pb`를 주지 않는다. 형제 구역은 빈 줄로 나눈다.
- 보기 상태 분기는 `match(view).exhaustive()`다. 중첩 삼항을 쓰지 않는다.
- route 파일은 `useRouteParamsOrRedirect(schema, { fallbackHref })`로 검증해 틀리면 그 `redirect`만 그리고 `params`를 읽지 않는다. 안쪽 화면(같은 파일의 지역 컴포넌트)이 같은 스키마의 튜플 훅(`useRouteParams`·`useTodoId`)으로 읽고 `resetKeys`도 거기서 정한다. 리다이렉트를 직접 만들지 않는다.
- 이동은 typed `router.push({ pathname, params })`다. 문자열 href를 조립하지 않는다.
- 상세 진입 행은 `Link`(+ `Link.Preview`·`Link.Menu`)를 쓴다. 끌기 모드에는 Menu를 붙이지 않는다.
- 검색은 `Stack.SearchBar`다. 디바운스는 es-toolkit `debounce`다.
- 레이아웃은 자식 route params·내 정보·창 크기를 구독하지 않는다. 구독이 필요하면 null을 그리는 형제 컴포넌트로 옮긴다(`RouteWatchers`, `SessionWatchers`, `ForegroundPushPresentation`).
- 네이티브 헤더(`Stack.Toolbar`)만 쓰고, 탭은 `NativeTabs` + 탭별 Stack이다.

자세히: [상태와 라우팅](../../docs/architecture/state-and-routing.md) · [UI](../../docs/architecture/ui.md)
