# 구조

기능을 어디에 두고, 기능 폴더에 무엇을 두고, 무엇이 무엇을 import하는지 정한다. 모델은 [model](./model.md), Api·저장소·쿼리·폼은 [data](./data.md), 상태·route는 [state-and-routing](./state-and-routing.md)이 원본이다. 아직 이 모양이 아닌 코드는 [1.15.2 다음 버전 후보](../../../../docs/releases/1.15.2/README.md#다음-버전-후보)에 있다. 지금 걸린 검사와 규칙 이름은 [guardrails](./guardrails.md)다.

## 앱 폴더

```text
app/                         Expo Router route 파일만
src/
├── bootstrap/               앱 조립. 낱개 파일 없이 폴더로 모은다
│   ├── auth/  hooks/        시작 인증 판정(순수), 앱 시작 때 한 번 도는 훅
│   ├── navigation/          인증 게이트 레이아웃, 콜드 스타트 링크, 두 route가 함께 쓰는 조립
│   ├── providers/           composition-root, create-device-ports, create-app-container, di-provider, di-context
│   └── query/  startup/     QueryClient·캐시 복원, 시작 때 한 번 하는 정리
├── core/                    ports(앱의 말), errors(Result·ApiError), events, observability, session
├── features/{area}/{feature}/
├── shared/                  제품 말 없이 설명되는 도구: date, i18n, infra(어댑터), storage, domains, hooks, ui …
└── testing/                 포트 stub, fake, render, 테스트 DI
```

- `shared/providers`는 어디서나 읽는 앱 설정 Context(테마, 언어, 글꼴 배율, 로컬 날짜)다. `bootstrap/providers`는 루트에 한 번 끼우는 조립과 전역 동작이고 `children`만 감싼다.
- `shared/stores`는 React 밖에서도 구독하는 메모리 저장소다. 기기 저장 값은 `shared/storage`가 맡는다([data](./data.md)).
- 다른 기능은 `@src/features/{area}/{feature}/…` 절대 경로로 import한다. 상대 경로는 같은 기능 안에서만 쓴다.
- 새 barrel `index.ts`를 만들지 않는다. 재수출은 이미 공개 면인 `shared/ui`, `shared/i18n`, `shared/errors`, `shared/analytics`, `shared/infra/{analytics,logger}`, `bootstrap/providers/di-context`(shared DI 훅)와 테스트 입구 `src/testing/core.ts`에만 있다(`aido/no-re-export`). `shared/ui`의 입구는 `shared/ui/index.ts` 하나이고 부품 폴더에는 `index.ts`를 두지 않는다(ls-lint, [ui-catalog](./ui-catalog.md)).

## 기능 경계

최상위는 서버 모듈과 같은 이름의 영역이다. 화면과 데이터가 같으면 한 기능이다.

| 영역                             | 기능                                                                          |
| -------------------------------- | ----------------------------------------------------------------------------- |
| `identity`                       | `auth`, `user`, `preference`, `consent`                                       |
| `planning`                       | `todo`, `category`, `composer`(여러 기능을 조립해 4층)                        |
| `notes`                          | `memo`(기준 기능)                                                             |
| `social`                         | `friend`, `invite`, `nudge`, `moderation`                                     |
| `engagement`                     | `comment`                                                                     |
| `insights`                       | `achievement`, `report`                                                       |
| `assistant`                      | `suggestion`                                                                  |
| `billing`                        | `subscription`(결제·권한·한도의 단일 입구, 다른 기능의 한도 캐시 반영도 여기) |
| `support`                        | `inquiry`                                                                     |
| `app-config`                     | `app-version`, `whats-new`                                                    |
| `device`                         | `widget`, `app-icon`, `store-review`, `activation`, `coachmark`               |
| `voice`·`notification`·`weather` | 영역이 곧 기능이라 한 단계다. 안쪽 파일은 엔티티 접두사로 나눈다              |

새 기능을 둘 곳은 이 순서로 정한다.

1. 서버 모듈이 있으면 그 이름 아래에 둔다.
2. 기기에서만 동작하면 `device/`에 둔다.
3. 파일 몇 개뿐이고 화면·데이터가 같으면 기존 기능에 넣는다.
4. 제품 말 없이 설명되고 2곳 이상이 쓰면 `shared/`에 둔다.
5. 여러 영역을 조립하는 일은 `app/`이 맡는다.

## 기능 폴더 골격

모든 기능이 같은 모양이다. 쓰는 폴더만 만든다.

```text
features/{area}/{feature}/
├── domains/        {entity}.model.ts        Zod 클라이언트 모델 + Filter·OrderBy 타입 + 이름 있는 순수 함수 + {Entity}Policy (업무 규칙만)
│                   {feature}.error.ts       기능 오류 코드, 칸 오류 매핑
├── schemas/        {name}-{form|params|request|response|payload|storage|draft|query-key|entry}.schema.ts
│                   (-storage.schema.ts에 저장 값 정의 defineStoredValue를 둔다)
├── apis/           {entity}.api.ts          서버 호출 클래스(HttpClient만, Result)
│                   {entity}.mapper.ts       바깥 값(서버 DTO, OS·SDK 값) ↔ 모델. 엔티티당 하나, 여기에만 둔다
├── services/       {name}.service.ts        기기·OS 유스케이스(포트·api·저장소 조합). 진짜 조율이 있을 때만
│                   {name}.session.ts        타이머·구독을 가진 수명 객체(dispose)
├── repositories/   {name}.repository.ts     저장 값 정의로 안 되는 것만(SecureStore 비동기, 파일, 접두사 열거·이주, 헤드리스 위젯)
├── stores/         {name}.store.ts          메모리 상태 기계(getSnapshot·subscribe)
├── queries/        {feature}-query-keys.ts  쿼리 키 팩토리(쿼리 옵션·cache helper와 함께 바뀐다)
│                   {feature}-mutation-keys.ts  mutation 키
│                   {entity}.queries.ts      useGet{X}QueryOptions (+ select)
│                   {entity}.mutations.ts    use{Verb}{X}MutationOptions (캐시 효과·확정 추적)
│                   {feature}-cache.ts       queryClient를 만지는 유일한 곳(무효화·갱신·refresh{Feature})
├── constants/      일반 상수만: {feature}.constants.ts(시간·한도·id), {entity}.events.ts(분석), {entity}-log-events.ts(로그 키)
├── components/     {역할}.tsx (네임스페이스 부속은 부모 파일 안, 부모 이름의 큰 묶음(파일 3개 이상)만 하위 폴더)
├── hooks/          use-{name}.ts (여러 파일이 쓰거나 app/·bootstrap이 쓰는 공개 훅)
├── utils/          {name}.view-model.ts(표시 값), {name}.geometry.ts(좌표), {feature}-draft.ts, {feature}-analytics.ts만(함수 이름 파일은 맞는 층으로)
└── __tests__/      {entity}.fixtures.ts(defineFixture), {route}-screen.test.tsx, {feature}.test-utils.tsx
```

- mapper는 `apis/`에만, 엔티티당 하나다. OS 권한과 서버 기기 DTO처럼 엔티티가 다르면 파일을 나눈다.
- 통과만 하는 repository와 service를 만들지 않는다. 저장 값 정의와 Policy로 충분하다.
- 쿼리 키는 `queries/`에 둔다. `constants/`는 일반 상수(시간·한도·id, 장면 팔레트 같은 고정 값)·이벤트·로그 키만 두고 `domains/`를 import하지 않는다. 업무 규칙 표는 모델에, 라벨 키는 view-model에, 저장 키는 `*-storage.schema.ts`에 둔다.
- 파일 이름은 kebab-case, 접두사는 다루는 엔티티 이름, 접미사는 위 골격의 역할 이름이다(역할 폴더별 접미사는 ls-lint). 기능 이름이 엔티티를 줄인 것이면 엔티티 이름을 쓴다(`social/nudge`의 `todo-nudge-query-keys.ts`). `helpers`·`utils`·`common` 같은 파일 이름을 쓰지 않는다.
- 캐시 모양만 다루는 순수 함수(무한 목록 페이지 고치기·cursor)는 `queries/{entity}-pages-cache.ts`에 둔다(`todo-comment-pages-cache.ts`). `queryClient`는 만지지 않고 `-cache.ts` helper가 부른다.
- `utils/`의 예외는 `store-review/utils/wait-for-settled-screen.ts` 하나다. 앱 상태 포트·타이머·abort로 화면이 가라앉기를 기다리는 한 번짜리 함수라 Session(수명 객체)이 아니고, 훅이 화면 판정(`isScreenReady`)을 넘겨 테스트가 시트·키보드·백그라운드 갈래를 모두 돈다.

## 층별 역할과 책임

층마다 변경 이유가 하나다. 상세 모양은 [model](./model.md)과 [data](./data.md), 컴포넌트·스크린은 [ui](./ui.md)에 있다.

| 층               | 하는 일                                                                     | 의존해도 되는 것                                                             | 하지 않는 것                                               | 모양                                                                                               |
| ---------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Model            | 업무 규칙: `can/should/is/has`, `calculate`, `filterBy`/`orderBy`, `with`   | zod, `@aido/api/vocabulary`·`common`·`errors`, `shared/date`(순수)           | 계약 import, i18n·색·배치·표시 방식, 시계 읽기, React      | `xSchema` + `type X` + 모듈 `function` + `XPolicy = { … } as const`(첫 인자 모델 전체)             |
| Server API       | 한 서버 모듈의 엔드포인트: 요청 → `parseApiResponse` → mapper               | `HttpClient`, mapper, AppLogger(응답 진단만)                                 | 저장소·OS 포트, 다른 api, 추적·Sentry                      | class, 화살표 필드, `#`. `Promise<Result<T, ApiError>>`, GET은 `signal`                            |
| Mapper           | 바깥 값 ↔ 모델의 유일한 변환                                                | domains, 계약 타입, 순수 날짜 도구                                           | 포트, 시계, 로그                                           | `to{Model}(dto)`, `to{X}Request(values)`, `to{X}FormValues(model)`, `parse{X}(unknown): X \| null` |
| Device Service   | 여러 포트·api·저장소를 엮는 유스케이스(푸시 등록, 소셜 로그인, 위젯 동기화) | 포트, `Pick<XApi, …>`, 저장 값 함수, Policy, AppLogger, `now: () => Instant` | `HttpClient` 직접, 추적·Sentry, 저장소만 통과시키는 메서드 | class. 결과 유니온                                                                                 |
| Session          | 타이머·구독 수명 객체                                                       | 포트                                                                         | 추적                                                       | 메서드 + `dispose()`                                                                               |
| Repository       | 저장 값 정의로 안 되는 저장소                                               | 저장 포트, storage schema, AppLogger                                         | Policy 판단, 시계, HTTP                                    | `create{Name}Repository(storage)`, `find*`→`T \| null`, `save/remove`, `subscribe`                 |
| Store            | 메모리 상태 기계(알림 진입, 인증 세션, 온보딩 가드)                         | Policy                                                                       | 포트, 영속                                                 | `create{Name}Store()` → `getSnapshot`·`subscribe`·이름 있는 동작                                   |
| Query options    | 캐시 키, `queryFn`(api + `unwrap`), `select`로 화면별 모양                  | api 훅, keys, model                                                          | 표시 문자열                                                | `useGet{X}QueryOptions({ filters, orderBy, limit, … })`                                            |
| Mutation options | 변경, 낙관적 갱신, 캐시 효과, 서버가 확정한 결과의 추적, 오류 메타          | api 훅, cache helper, `useTrack`                                             | 화면 이동                                                  | `use{Verb}{X}MutationOptions()` → `mutationOptions`. 변수는 `*Variables`                           |
| Cache helper     | `queryClient`를 만지는 유일한 곳                                            | keys, model                                                                  | 이벤트·보고·api                                            | `invalidate{X}`, `set{X}InCache`, `refresh{Feature}`                                               |
| View-model       | 모델 → 표시 값(i18n 키, 포맷, 색 토큰)                                      | model, 날짜 포맷                                                             | 거르기·묶기(그건 `select`), 업무 판정                      | `get{X}LabelKey`, `format{X}`                                                                      |
| Hook             | 상태·구독·route를 묶은 한 책임                                              | 위 전부                                                                      | 포괄 훅, 위치 불리언 인자                                  | 상태·route는 튜플                                                                                  |
| Component        | 자기 데이터 조회, 표시, 동작                                                | 위 전부                                                                      | 바깥 레이아웃, 화면 id prop                                | `X` + 부모 없이 의미 없는 부속은 `X.Part`                                                          |
| Screen           | 배치·간격·경계·화면 문구·`match(view)`                                      | 컴포넌트, route 훅                                                           | 데이터 변환, 긴 effect, 폼 제출                            | 위에서 아래로 읽힌다                                                                               |

## 층과 의존

아래 층은 위 층을 모른다. 고칠 때 영향이 위로만 번진다.

| 층  | 포함                                                                                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5   | `app/`, `bootstrap`                                                                                                                                                                             |
| 4   | `planning/composer`, `notes/memo`, `weather`, `notification`, `social/invite`, `device/activation`                                                                                              |
| 3   | `voice`, `engagement/comment`, `social/friend`, `social/nudge`, `social/moderation`, `assistant/suggestion`, `insights/achievement`, `insights/report`, `app-config/whats-new`, `device/widget` |
| 2   | `planning/todo`, `planning/category`, `device/coachmark`, `device/store-review`                                                                                                                 |
| 1   | `identity/*`, `billing/subscription`, `support/inquiry`, `app-config/app-version`, `device/app-icon`                                                                                            |
| 0   | `shared` → `core`. `core`는 아무것도 import하지 않고 `shared`는 feature·`bootstrap`을 import하지 않는다                                                                                         |

| 가져오는 쪽에서 본 대상 | 가져와도 되는 것                                                        |
| ----------------------- | ----------------------------------------------------------------------- |
| 아래 층                 | 타입, 모델(Policy), cache helper, 쿼리 옵션, 훅, 컴포넌트, 스키마, 상수 |
| 같은 층                 | 아래 층과 같다. 단 한 방향만이다. 타입만 서로 import해도 양방향이다     |
| 위 층                   | 타입, 모델(Policy), cache helper만                                      |

- 표에 없는 기능은 층이 정해질 때까지 import하지 않는다. 새 기능은 층 표와 dependency-cruiser 설정에 함께 더한다.
- `di-context`의 `use{X}` 훅은 돌려주는 값의 주인 기능을 import한 것으로 센다.
- `device/*`는 묶음일 뿐 한 층이 아니다. 실제로 보는 대상에 맞춰 둔다(`activation`은 할 일·알림·초대를 읽어 4층, `app-icon`은 1층).
- 다른 기능의 `apis/`는 가져오지 않는다. 순수 변환인 `planning/todo/apis/todo-repeat.mapper.ts`, `planning/todo/apis/todo.mapper.ts`(메모 옮기기의 `toCreateTodoRequest`, 할 일 고치기 시트의 `toTodoFormValues`), `billing/subscription/apis/entitlement.mapper.ts`만 예외다.
- `app/` 파일은 모두 route라 공용 파일을 옆에 둘 수 없다. 두 route가 같은 조립을 쓰면 route에서 export하지 않고 컴포넌트로 둔다. 한 기능의 조각만 조립하면 그 기능의 `components/`(`notification/components/weather-notification-settings/weather-notification-settings.tsx`), 여러 기능을 조립하면 `bootstrap/navigation/`(`my-page-stack.tsx`, `subscription-checkout.tsx`)이다.
- 테스트 도구(`src/testing/`)는 조립을 위해 위층을 볼 수 있다. 층 규칙은 운영 코드에만 걸린다.

위 층이 필요하면 아래 넷 중 하나로 끊는다. 새 방법을 더하지 않는다.

| 위 층이 필요한 이유                          | 끊는 방법                                                                                                                                                                                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 화면 조각을 함께 보여 줌                     | **슬롯.** `app/`이 조립해 `ReactNode`나 컴포넌트를 prop으로 넘긴다(`ProfileRow`의 `tierChip`)                                                                                                                                               |
| 위 층 값이나 동작이 필요함                   | **인자.** 호출한 쪽이 값·콜백을 인자, prop, 생성자 포트로 넘긴다(`PlanReview`의 `onMemoChanged`)                                                                                                                                            |
| 다른 기능의 캐시를 갱신                      | **캐시 meta.** 대상이 정해졌으면 그 기능이 내보낸 cache helper를 부른다. 대상이 여럿이면 아래 층이 무효화하고 위 층 쿼리가 `meta.refreshOn*`로 신청한다(`refreshOnTodoChange`, `refreshOnPremiumChange`). 남의 `all` 키는 무효화하지 않는다 |
| 캐시 밖에서 알리거나 받는 쪽이 정해지지 않음 | **이벤트.** `core/events`(`notifications-changed`, `session-confirmed`, `session-expired`, `todo-created`, `todo-completion-changed`)                                                                                                       |

## DI·포트·수명

```text
core/ports(앱의 말) ← shared/infra(어댑터, SDK import는 여기만) ← create-device-ports
composition-root(프로세스 수명) → DIProvider: createAppContainer(ports)(순수, 마운트마다) → di-context(use{X}, 유일한 입구)
테스트: createTestPorts → createTestDi({ ports, seeds }) → renderScreen / renderAppRoute / renderRouteHook
```

- **포트는 앱의 말로 짓는다.** SDK·공급자 이름을 쓰지 않는다(`setString` → `copy`). 읽기는 `get*`, 구독은 `subscribe*`이고 해제 함수를 돌려준다. SDK 타입을 내보내지 않고 plain 값을 넘긴다. "없음"은 포트마다 하나로 정한다(`null` 권장). 라이브러리·DOM 전역과 겹치는 이름은 쓰지 않는다(`AppLogger`, `KeyValueStorage`, `useAppTheme`).
- **같은 개념은 타입 하나다.** 시계는 `now: () => Instant`, 앱 앞·뒤 전환은 `AppLifecycleGateway`, OS 권한은 `OsPermission`(`core/ports/os-permission.ts`, `status`·`canAskAgain`)이다. `AppState`를 직접 쓰지 않는다.
- **SDK는 `shared/infra`에서만 import한다.** 어댑터는 `shared/infra/{영역}/{공급자}-{포트 파일 이름}.ts`이고 포트 하나에 파일 하나다(`expo-clipboard-gateway.ts` → `expoClipboardGateway`). 플랫폼·OS 버전 차이는 어댑터 안에 숨긴다. 어댑터의 상태는 인스턴스 필드나 어댑터 팩토리의 클로저 변수에 두고, `logger`·`errorReporter`는 팩토리 인자로 받는다.
- **조립은 `createAppContainer(ports)` 한 함수다.** 운영은 기기 어댑터, 테스트는 stub 포트를 넘긴다. 객체만 만들고 SDK import, 구독, 타이머, 전역 값 변경, 저장소 쓰기를 하지 않는다. 연결은 쓰는 Provider·훅의 effect가 맡는다.
- **컨테이너에는 화면이 꺼내는 것만 둔다.** Api·service를 만드는 데만 쓰는 포트(`KeyValueStorage`, `PurchasesGateway`, HTTP 클라이언트, 토큰 갱신기)는 `AppContainerPorts`에만 있다. mapper·Policy·view-model은 순수 함수라 DI에 넣지 않고 직접 import한다.
- **꺼내는 입구는 `bootstrap/providers/di-context.tsx` 하나다.** DI 훅은 `use{Entity}Api`, `use{Name}Service`, `use{Name}Repository`, `use{Name}Store`이고 훅 이름은 컨테이너 필드 이름과 같다. 포트는 필드·훅 모두 역할 이름이고 `Gateway`를 붙이지 않는다(`haptics`·`useHaptics`, `purchases`, `socialShare`). 공개·인증 HTTP 짝은 어디서나 `publicHttpClient`·`authHttpClient`이고, 생성자 의존 객체 타입은 `{X}Ports`다. `shared/di/shared-di-context.tsx`는 `shared`만 쓰고 `di-context`가 다시 내보낸다. `DIContainer`·`createAppContainer`의 반환·di-context 훅은 같은 순서다(포트 → 기능 층 표 1→4, 기능마다 빈 줄). 훅이 없는 필드는 시작·세션 정리만 쓰는 저장소(`coachmarkRepository`, `activationProgressRepository`)뿐이다.
- **라이브러리 교체는 어댑터 하나와 `create-device-ports` 한 줄이다.** 어댑터 밖이 바뀌면 포트 설계가 틀린 것이다. 새 포트는 `core/ports` → 어댑터 → `create-device-ports` → `createTestPorts` stub 기본값을 함께 더한다.

| 수명     | 무엇                                                                                                                                                                                                                                  | 만드는 곳                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 프로세스 | `AppLogger`·`Analytics`·`ErrorReporter`, `QueryClient`, 보안·암호화 저장소, `TokenStore`·토큰 갱신기, HTTP 클라이언트, 결제 SDK 게이트웨이, 그 밖의 기기 어댑터, 루트 "다시 시도"를 넘어 기억할 메모리 store(`inviteLinkOpenedStore`) | `composition-root.ts`가 한 번                         |
| 마운트   | Api, service, repository, store                                                                                                                                                                                                       | `DIProvider`가 마운트마다 `createAppContainer(ports)` |

- 프로세스 수명 객체를 담는 모듈 수준 값은 `composition-root.ts`에만 둔다. 그 밖의 모듈 전역 상태는 DI store(`pushOnboardingGuardStore`, `myPagePaneLayoutStore`, `myPageDetailRootStore`, 프로세스 수명 포트의 `inviteLinkOpenedStore`)나 어댑터 팩토리의 클로저 변수(푸시 게이트웨이의 앞 알림 표시 판단)로 옮긴다. DI보다 먼저 있거나 DI 밖에서 읽어 옮길 수 없는 것만 남기고 늘리지 않는다.
  - `bootstrap/navigation/cold-start-link`: 앱 트리·DI보다 먼저 받은 첫 URL을 Index가 한 번 읽는다
  - `shared/ui/bottom-sheet/keyboard-bottom-sheet`의 열린 시트 수: 키보드 컨트롤러가 네이티브 전역 하나라 수도 그 수명을 따른다
  - `shared/infra/logger/global-logger`: DI 밖(루트 오류 화면, 접근성 설정 store, 위젯 진입점)이 쓰는 로거. `composition-root`가 한 번 정한다
  - `core/events/*`의 이벤트 채널 리스너와 `event-channel`의 리스너 오류 보고기: `core`는 DI를 모른다. 구독은 해제 함수를 돌려주고 보고기는 `DIProvider`가 마운트 때 건다
  - 접근성 설정 store(`shared/hooks/use-is-reduce-motion-enabled`, `features/weather/hooks/use-is-reduce-transparency-enabled`): OS 설정 하나를 구독 하나로 나눠 읽는다. 모션 줄이기는 DI 밖(루트 오류 화면)에서도 그리는 `shared/ui`가 읽는다
  - `shared/infra/storage/widget-storage.android`, `shared/infra/app-lifecycle/react-native-app-lifecycle-gateway`, `features/device/widget/bridge/android-widgets.bridge`의 스냅숏·이동 저장소와 렌더러: 위젯만 깨어난 헤드리스 프로세스에는 앱 트리·DI가 없다. 앱의 조립은 `create-device-ports`가 같은 값을 넘긴다
  - `features/billing/subscription/hooks/use-report-store-unavailable`의 보고한 진단 코드(`WeakMap<ErrorReporter, Set<string>>`): 같은 스토어 설정 문제를 앱 실행마다 한 번만 남긴다. 마운트 수명 DI store는 루트 "다시 시도"마다 새로 만들어져 다시 보낸다. 키가 프로세스 수명 `ErrorReporter`라 그 수명을 따른다
  - React 밖 cache helper가 부르는 `shared/utils/create-optimistic-id`(프로세스 안에서 겹치지 않아야 한다)와 `features/planning/todo/queries/todo-cache`의 쓰기 순번(`WeakMap<QueryClient, number>`, 먼저 시작해 늦게 끝난 쓰기 사이를 센다. `QueryClient` 수명을 따른다)
  - `shared/date/format/intl-formatter`의 포매터 캐시, `shared/utils/number-format`의 퍼센트 포매터(많아야 4개): 상태가 아닌 순수 캐시다
  - `shared/infra/storage/device-sync-storage`의 MMKV 인스턴스: DI보다 먼저 그리는 설정 Provider(테마·언어·글꼴)와 `i18n/init`이 읽는다
  - `shared/infra/observability/capture-error`의 보고한 오류 `WeakSet`: DI 밖(루트 경계·전역 로거)과 안의 보고가 같은 오류를 두 번 보내지 않게 하는 한 곳이고 오류 객체와 함께 사라진다
  - `bootstrap/query/{mutation-error-feedback,query-error-report}-cache`의 구독자 표: 캐시 `onError`는 DI 밖 `createAppQueryClient`에서 만들어진다. 표는 캐시를 키로 한 `WeakMap`이라 캐시마다 따로이고 캐시와 함께 사라진다
  - `app/+native-intent`의 초대 링크 도장(마지막 한 칸)과 그 변환이 보던 탭을 읽는 `shared/navigation/selected-tab-path`의 `navigationContainer`, `app/_layout`의 `rootErrorReporter`: 시스템 URL 변환은 앱 트리·DI보다 먼저 React 밖에서 돌고, 루트 오류 경계는 DI 밖에서 그려질 수 있다. expo-router는 내비게이션 컨테이너를 훅(`useNavigationContainerRef`) 말고 공개하지 않아, 루트 레이아웃이 묶는 훅(`useBindSelectedTabPath`, 언마운트 때 비운다)과 읽는 함수(`toSelectedTabPath`)를 한 파일에 두어 이 값을 쓰고 읽는 곳을 그 둘로 묶는다
  - `shared/hooks/use-rebuilt-path`의 `EMPTY_PATH`: 그리기 전과 놓은 뒤 Canvas가 읽는 빈 Skia 경로 하나다. 모든 훅이 함께 쓰고 놓지 않아 프로세스 수명이다
- 루트 "다시 시도"는 마운트 수명 컨테이너만 새로 만든다. 로그인·결제 설정·보고는 그대로 남는다.
- 언마운트·로그아웃 뒤에 도는 일이 없어야 한다. await 뒤 상태 변경·이동은 막고, 핸들러가 건 rAF·타이머는 지우고, 리스너 세트 대신 `subscribe`가 해제 함수를 돌려주는 관찰 가능한 저장소를 쓴다. 화면 밖에서 늦게 오는 쓰기(초안 자동 저장의 마지막 저장, 늦은 녹음 파일)는 로그아웃·탈퇴 세대(`SignOutEpoch`)와 비교해 로그아웃·탈퇴 뒤에는 쓰지 않는다(`DraftService.createSessionSave`, `VoiceRecordingIntakeSession`). 세션 만료는 같은 사람이 돌아와 이어 쓰므로 막지 않는다. 결제 SDK 로그인·로그아웃은 `PurchasesSession`이 하나씩, 마지막 요청만 보내고 멈춘 호출(로그인 뒤 속성 동기화 포함)은 `PURCHASES_SDK_CALL_TIMEOUT_MS`(15초)에서 끊는다. 결제·복원은 그때의 SDK 사용자에게 귀속되므로 `waitForSignedInUser`로 로그인·로그아웃이 끝나길 기다리고, 마지막 계정의 로그인이 실패·시간 초과였으면 그 계정으로 다시 로그인해 기다린 뒤 그래도 아니면 스토어 연결 오류(`SUBSCRIPTION_STORE_PROBLEM`)로 막는다. 상세: [data의 메모리와 수명](./data.md#메모리와-수명).

`shared/infra`를 직접 import하거나 SDK를 포트 없이 쓰는 곳은 아래뿐이다. 늘리지 않는다.

- `shared/infra` 안 경계 파일(`audio/use-audio-part-playlist.ts`, `keep-awake/use-keep-screen-awake.ts`, `localization/device-locale.ts`, `linking/use-linking-url.ts`, `view-capture/capturable-view.tsx`): 라이브러리 자체가 훅·컴포넌트라 DI 값으로 바꿀 수 없다
- `create-device-ports`·`composition-root`, `app/_layout.tsx`의 루트 오류 보고기, `bootstrap/navigation/open-support-mail.ts`(루트 경계의 문의 메일): 조립하는 곳이거나 Provider 밖에서 그려진다
- 위젯 진입점(`device/widget/bridge/`), `shared/infra/device/device-info.ts`의 시작 상수, DI보다 위의 Provider: 앱 트리·DI가 없거나 DI보다 먼저다
- `expo-router`(route와 route 경계 훅), `shared/config/env.ts`의 `expo-constants`, 루트 레이아웃의 `expo-splash-screen`: 포트로 숨기지 않는 라이브러리다

## 공개 면

- 같은 기능 안에서 한 파일만 쓰는 훅·컴포넌트는 그 파일의 지역 함수, 여러 파일이나 다른 기능이 쓰면 `hooks/`·`components/`다. 부모 없이 의미 없는 조각은 부모 파일의 `Parent.Part`다([ui](./ui.md)).
- `app/`·`bootstrap`이 쓰는 훅·컴포넌트는 쓰는 곳이 하나여도 공개 면이라 기능 폴더에 남긴다.
- 공개 면도 정의 파일에서 직접 import한다. 쓰지 않는 export는 knip이 막는다.

## 함수 형태

- 모듈 수준 함수(컴포넌트, 훅, 순수 함수, mapper, query options, `select`, fixture)는 `function` 선언이고 네임스페이스 조각은 `X.Item = function Item()`이다(`aido/function-declaration`, `aido/namespace-function-name`).
- 클래스 메서드는 화살표 필드 + `#` 비공개(`KyHttpClient`, `SecureStorage`, `ApiError`도)이고 생성자 파라미터 프로퍼티 대신 필드를 선언한다. 팩토리가 돌려주는 객체(어댑터, store, repository, 세션)는 화살표 속성이고 메서드 축약(`get() {}`)을 쓰지 않는다. 컴포넌트 안 핸들러·인라인 콜백·키 객체 값은 화살표다.
- 시간 상수는 이름에 단위를 넣는다(`SHEET_ANIMATION_DURATION_MS`, `ANIMATION.durationMs.fast`, `STORE_PREMIUM_SYNC_DELAYS_MS`).
