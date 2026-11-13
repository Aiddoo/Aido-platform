---
paths:
  - 'src/**/*.tsx'
---

# 컴포넌트

**패턴**

- `AmountInput`: 역할이 있는 래퍼만 만들고 원본 Props를 유지한다.
- `CalculationResult`: route 튜플로 id를 읽고 `== null`이면 비어 있음 조각을 그린다. 좁힌 id로 `useSuspenseQuery`하는 조각에서 조기 반환한 뒤 그린다.
- `ProductList`: `filters`·`orderBy`·`limit` 인터페이스를 두고 행·로딩·오류 같은 부속을 부모 아래에 둔다.
- 컴포넌트는 자기 데이터를 스스로 조회한다. 화면 id는 prop이 아니라 route 훅으로 읽는다. 목록 행은 route 훅을 부르지 않는다.
- 부모 없이 의미 없는 조각은 종류와 무관하게 `Parent.Part`로 부모 파일에 둔다(`X.Item = function Item()`). 쓰지 않는 부속은 만들지 않는다.
- 같은 모양으로 반복되는 고정 UI는 역할이 드러나는 지역 컴포넌트를 만들고 항목마다 한 줄씩 쓴다. 설정 배열을 `.map`하지 않는다. 서버 데이터 목록만 `.map`·`FlashList`다.
- 위치 이름(`*Section`·`*Detail`·`*Content`·`*Panel`·`*Inner` 등, 단독 `*Header`·`*Footer`)을 쓰지 않는다(`aido/component-name`, 전체 목록은 [UI](../../docs/architecture/ui.md#네임스페이스반복-ui추출)).
- 컴포넌트는 바깥 여백(`m*`)을 모른다. 간격은 부모가 `<Spacing>`으로 둔다.

**부품과 스타일**

- 부품은 heroui-native → `shared/ui` → React Native 순으로 찾는다. 감싸는 부품은 `Omit<ComponentProps<typeof X>, …>`로 원본 Props를 유지한다.
- 클래스는 `cn`·`tv`로 조합한다. 문자열 연결·삼항 className을 쓰지 않는다. 인라인 `style`은 동적 값만 쓴다.
- 플랫폼 분기는 `process.env.EXPO_OS`다. 글꼴은 앱 5단계를 쓴다.

**코드 배치**

- 몸체 순서(그룹 사이 빈 줄 하나, 그룹 안에는 없음): `t`·DI → route params → 쿼리 → 지역 상태·ref → mutation·동작 훅 → 파생 값 → effect → 조기 반환 → 핸들러 → JSX.
- 파일 순서: 상수·타입 → 기본 export → 네임스페이스 부속 → `.Loading` → `.Error` → `.Empty` → 지역 컴포넌트 → 지역 훅 → 순수 helper.
- 컴포넌트·훅은 모듈 수준 `function`, 핸들러·콜백은 화살표다.
- 훅은 한 책임이고 상태·route는 `[value, setValue]` 튜플이다. 위치 불리언 인자 대신 객체를 쓴다.

자세히: [UI](../../docs/architecture/ui.md) · [UI 카탈로그](../../docs/architecture/ui-catalog.md) · [훅](../../docs/architecture/hooks.md) · [디자인](../../docs/design.md)
