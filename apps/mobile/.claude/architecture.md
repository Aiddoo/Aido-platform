# Mobile App Architecture Guide

**Version**: 3.1.2 · **Last Updated**: 2026-11-11 · **Owner**: Aido Mobile Team

Feature-based Layered Architecture로 만든 React Native/Expo 앱의 규칙이다. 앱에만 해당하는 규칙을 여기에 둔다. 기준 코드는 `features/notes/memo`와 메모 화면이다. 다른 feature와의 차이는 [아직 옮기지 않은 것](#아직-옮기지-않은-것)에 적는다.

| 주제                                                    | 원본                                                                           |
| ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| SOLID·이름·주석·`if` 중괄호·라이브러리·테스트 범위·정리 | [루트 공통 코드 규칙](../../../AGENTS.md#공통-코드-규칙)                       |
| null·undefined·비교                                     | [nullish](../../../docs/conventions/nullish.md)                                |
| 날짜·시간대·표시 언어                                   | [dates](../../../docs/conventions/dates.md)                                    |
| 응답·오류 계약, 앱의 오류 처리                          | [errors](../../../docs/conventions/errors.md), [앱](../docs/error-handling.md) |
| 하위 호환                                               | [compatibility](../../../docs/conventions/compatibility.md)                    |
| UI 부품·스타일·애니메이션·safe area                     | [ui-components](./ui-components.md)                                            |
| Analytics·Sentry                                        | [observability](./observability.md)                                            |
| 테스트                                                  | [testing-guide](./testing-guide.md)                                            |

---

## 코드 품질 판단 기준

가독성, 예측 가능성, 응집도, 결합도는 [Frontend Fundamentals 코드 품질](https://frontend-fundamentals.com/code-quality/)을 기준으로 판단한다. 좋은 코드는 변경하기 쉬운 코드다. 네 기준은 서로 부딪히므로 함께 안 고치면 오류가 나는 경우에만 공통화하고, 위험이 낮으면 중복을 허용해 나열한다. 이 앱에서는 예시 문법을 옮기지 않고 원칙만 적용한다(`if` 중괄호, 모듈 수준 `function`, `switch` 대신 `match`, `as` 금지). 업무 규칙은 Policy에 두고 SDK는 포트 뒤에 둔다.

## 디렉토리 구조

```
app/                              # Expo Router 화면. 화면 구성이 여기서 읽힌다
src/
├── bootstrap/                    # 앱 조립. 낱개 파일은 두지 않고 폴더로 모은다
│   ├── auth/                     # 순수 시작 판정 (resolve-initial-auth-status.ts)
│   ├── hooks/                    # 앱 시작 때 한 번 도는 훅 (use-auth-boot, use-sync-user-identity, use-claim-device-data-for-user, use-widget-app-entry)
│   ├── navigation/               # 인증 게이트 레이아웃, 콜드 스타트 링크, 루트 오류 경계 로그 키
│   ├── providers/                # 루트에 끼우는 Provider와 DI 조립
│   │   ├── di-provider.tsx       # 서비스·어댑터 조립 (한 곳)
│   │   └── di-context.tsx        # DIContainer 타입과 use{X} 훅
│   ├── query/                    # QueryClient 설정, 캐시 복원, 재시도, 온라인 감시
│   └── startup/                  # 앱 시작 때 한 번 하는 정리 (startup-key-cleanup.ts)
├── core/
│   ├── ports/                    # 포트 인터페이스
│   ├── errors/                   # 포트가 돌려주는 Result, ApiError
│   ├── observability/            # 오류·이벤트 계약: Sentry 키, breadcrumb, 사용자 속성, 로그 이벤트 키 검사 테스트
│   ├── events/
│   └── session/
├── features/{area}/{feature}/    # 서버 모듈 이름의 업무 영역 + 단수 kebab-case 기능
│   ├── schemas/                  # 폼·초안·route·쿼리 키·기기 저장·서버와 주고받는 모양. {name}-{form|params|draft|query-key|storage|request|response|payload|entry}.schema.ts
│   ├── domains/                  # {entity}.model.ts(모델 스키마·타입 + 순수 함수 + Policy), {feature}.error.ts
│   ├── apis/                     # {feature}.service.ts, {entity}.mapper.ts, {name}.repository.ts
│   ├── constants/                # {feature}-query-keys.ts, {feature}.constants.ts
│   ├── queries/                  # {entity}.queries.ts, {entity}.mutations.ts, {feature}-cache.ts
│   ├── components/               # {역할}.tsx. 함께 바뀌는 묶음만 하위 폴더
│   ├── hooks/                    # 여러 파일이 쓰는 훅 (route 읽기, 상태 튜플)
│   ├── utils/                    # {feature}-draft.ts, {name}.view-model.ts, 순수 계산
│   └── __tests__/                # {entity}.fixtures.ts, {feature}.test-utils.ts
└── shared/                       # analytics, config, constants, date, di, draft, errors, hooks, i18n,
                                  # infra(어댑터), preferences, providers, schemas, stores, types, ui, utils
```

- 로컬 저장소(SecureStore·MMKV)는 `apis/{name}.repository.ts`로 둔다. `create{Name}Repository` 함수 하나가 `{Name}Repository` 인터페이스를 돌려주고 메서드는 화살표 속성이다. 위젯의 네이티브 경계는 `features/device/widget/bridge/`에 둔다.
- 다른 피처는 `@src/features/{area}/{feature}/…` 절대 경로로 import한다.

### shared와 bootstrap의 폴더 기준

- `shared/providers`는 기능과 상관없이 어디서든 읽는 앱 설정 Context다(테마, 언어, 글꼴 배율, 로컬 날짜, 키보드 아래 여백). 값을 `use{X}` 훅으로 읽는다. `bootstrap/providers`는 루트에 한 번 끼우는 조립과 전역 동작이다(DI, Query, 인증 시작, 알림, 결제, 제스처). 값을 내려보내지 않고 `children`만 감싼다.
- `shared/stores`는 React 밖에서도 읽고 구독하는 모듈 단일 저장소다(`createXStore` + `useSyncExternalStore`). 기기 저장소(MMKV)를 읽고 쓰는 일은 `SyncStorage` 포트와 `use-sync-storage-string`이 맡고, `stores`는 메모리 상태만 가진다.
- 폴더 `index.ts` 재수출(배럴)은 `shared/ui`, `shared/infra/{analytics,logger,error-reporter}`, `shared/errors`, `shared/analytics`, `shared/__tests__`처럼 여러 파일이 하나의 공개 면이 되는 곳에만 둔다. 새 배럴은 만들지 않고 정의 파일에서 직접 import한다.
- 로그 이벤트 키는 쓰는 파일 옆에 둔다(`shared/hooks/open-url-log-events.ts`). `core/observability`는 오류와 이벤트의 계약(Sentry 키, breadcrumb, 사용자 속성)과 키 형식 테스트를 갖고, `shared/infra/observability`는 Sentry 초기화와 개인정보 지우기(`scrub-sentry-event`)를 갖는다. `shared/observability` 폴더는 없다.
- `bootstrap`에는 낱개 파일을 두지 않는다. 시작 판정은 `auth/`, 한 번 도는 훅은 `hooks/`, 루트 Provider는 `providers/`, 시작 때 한 번 하는 정리는 `startup/`이다.

### 기능을 어디에 두나

최상위는 서버 모듈과 같은 이름의 업무 영역이다. 서버와 앱에서 같은 이름으로 찾기 위해서다. `voice`, `notification`, `weather`는 영역이 곧 기능이라 한 단계다.

| 영역         | 기능                                                            |
| ------------ | --------------------------------------------------------------- |
| `identity`   | `auth`, `user`, `preference`, `consent`                         |
| `planning`   | `todo`, `category`, `composer`                                  |
| `notes`      | `memo`                                                          |
| `social`     | `friend`, `invite`, `nudge`, `moderation`                       |
| `engagement` | `comment`                                                       |
| `insights`   | `achievement`, `report`                                         |
| `assistant`  | `suggestion`                                                    |
| `billing`    | `subscription`                                                  |
| `support`    | `inquiry`                                                       |
| `app-config` | `app-version`, `feature-campaign`, `whats-new`                  |
| `device`     | `widget`, `app-icon`, `store-review`, `activation`, `coachmark` |

새 기능은 이 순서로 판단한다.

1. 서버 모듈이 있으면 그 이름 아래에 둔다.
2. 서버 없이 기기에서만 동작하면 `device/`에 둔다.
3. 같은 영역에 파일 몇 개뿐이고 화면과 데이터가 같으면 새 폴더를 만들지 않고 기존 기능에 넣는다.
4. 제품 말 없이 설명되고 2곳 이상이 쓰면 `shared`로 올린다.
5. 여러 영역을 함께 보여 주는 일은 `app/`이 조립한다.

- 폴더 `index.ts` 재수출을 새로 만들지 않고 정의 파일에서 직접 import한다.

## 의존성 흐름

```
Screen(app/) → components·hooks·queries → Service(apis/) → Port(core/ports) ← Adapter(shared/infra)
                                 └──────→ Model·Policy(domains/) ←── Mapper(apis/)
                                 └──────→ Schema(schemas/) ←── @aido/api 계약
```

의존성은 안쪽(Model)으로 향한다. Model은 Service·UI·SDK를 모른다.

## 층과 의존

아래 층이 위 층을 모르게 해서, 고칠 때 영향이 위로만 번지게 한다. 표는 `FEATURE_LAYERS`(`scripts/check-mobile-conventions.mjs`)와 같다.

| 층  | 포함                                                                                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5   | `app/`, `bootstrap`                                                                                                                                                                             |
| 4   | `planning/composer`, `notes/memo`, `weather`, `notification`, `social/invite`, `device/activation`                                                                                              |
| 3   | `voice`, `engagement/comment`, `social/friend`, `social/nudge`, `social/moderation`, `assistant/suggestion`, `insights/achievement`, `insights/report`, `app-config/whats-new`, `device/widget` |
| 2   | `planning/todo`, `planning/category`, `device/coachmark`, `device/store-review`                                                                                                                 |
| 1   | `identity/*`, `billing/subscription`, `support/inquiry`, `app-config/app-version`, `app-config/feature-campaign`, `device/app-icon`                                                             |
| 0   | `shared` → `core`. `core`는 아무것도 보지 않고, `shared`는 feature와 `bootstrap`을 보지 않는다                                                                                                  |

| 가져오는 쪽에서 본 대상 | 가져와도 되는 것                                                          |
| ----------------------- | ------------------------------------------------------------------------- |
| 아래 층                 | 타입, 모델(Policy), `*-cache`, 쿼리 옵션, 훅, 컴포넌트, 스키마, 상수      |
| 같은 층                 | 아래 층과 같다. 단 한 방향만이다. 서로 import하면 타입만이어도 양방향이다 |
| 위 층                   | 타입, 모델(Policy), `*-cache`만                                           |

**정해 둔 자리**

- **`device/*`**: 기기 전용이라는 묶음일 뿐 한 층이 아니다. 실제로 보는 대상에 맞춰 각각 둔다. `activation`은 체크리스트가 할 일, 알림, 초대를 읽어 4층이고, 아래에서는 `activation-cache`만 쓴다. 할 일은 활성화가 읽으므로 완료 기록을 `todo-completion-changed` 이벤트로 알리고, `(app)/_layout`이 `useRecordTodoCompletion`으로 받는다. `app-icon`은 마이페이지가 쓰고 아무것도 보지 않아 1층이다.
- **`app-config/feature-campaign`**: 캠페인 설정 조회뿐이라 1층이다. `whats-new`, `activation`이 읽는다.
- **`billing/subscription/apis/entitlement.mapper`**: 응답의 한도 조각을 여러 기능의 mapper와 mutation이 읽는다. 다른 feature의 `apis/`는 가져오지 않는 것이 원칙이고 이 파일과 순수 변환인 `planning/todo/apis/todo-repeat.mapper`만 예외다. 조립할 일이 아니라 변환이라 자리를 옮기지 않는다.
- **`shared/__tests__`**: 테스트 도구는 조립을 위해 위층을 볼 수 있다. 운영 코드만 층 규칙을 받는다.
- **`app/` 안 route 간 import**: `app/` 안 파일은 모두 route가 되어 공용 파일을 옆에 둘 수 없고, 조립 대상이 여러 층이면 feature로 내릴 수도 없다. 그래서 두 route가 같은 조립을 쓰면 route 파일에서 export하지 않고 5층인 `bootstrap/navigation/`에 컴포넌트로 둔다(`(tabs)/(mypage)/_layout`과 `(tabs)/(mypage)/mypage/index`가 `MyPageMenuPane`을, `(tabs)/(mypage)/_layout`이 `MyPageStack`을, `/settings/subscription`과 `/paywall`이 `SubscriptionCheckout`을, `/settings/notifications/weather`와 `/weather/settings`가 `WeatherNotificationSettings`를 쓴다).

**끊는 방법**

| 위층이 필요한 이유                         | 끊는 방법                                                                                                                                                                                                                                                                        |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 화면 조각을 함께 보여 줌                   | **슬롯.** `app/`이 조립해 `ReactNode`나 컴포넌트를 prop으로 넘긴다. 받은 쪽이 값을 넘겨 그려야 할 때만 컴포넌트다(`ProfileRow`의 `tierChip`, `FriendTodoList`의 `rowAction`)                                                                                                     |
| 위층 값이나 동작이 필요함                  | **인자.** 호출한 쪽이 값이나 콜백을 인자, prop, 생성자 포트로 넘긴다(`useStableFeedForeground`, `PlanReview`의 `onMemoChanged`, `AddFriendForm`의 `onFriendLimitInvite`, `SessionCleanupService`의 `userDeviceData`)                                                             |
| 다른 기능의 캐시를 갱신                    | **캐시.** 대상이 정해졌으면 위층의 `*-cache` 함수를 쓴다. 대상이 여럿이면 아래층 `*-cache`가 무효화하고 위층 쿼리가 `meta`로 신청한다(`invalidateTodoDependentQueries`와 `refreshOnTodoChange`, `refreshOnPremiumChange`, `invalidateAfterBlockChange`와 `refreshOnBlockChange`) |
| 캐시 밖에서 받거나 받는 쪽이 정해지지 않음 | **이벤트.** `core/events`(`notifications-changed`, `session-expired`, `todo-completion-changed`)                                                                                                                                                                                 |

코드에 있는 7가지는 위 4가지로 묶인다. 컴포넌트 prop은 슬롯, 콜백은 인자, `meta`는 캐시다. 새 방법을 더하지 않는다.

## check:conventions가 막는 것

`pnpm --filter @aido/mobile check:conventions`(`scripts/check-mobile-conventions.mjs`)가 다음을 실패시킨다.

| 검사                 | 내용                                                                                                                                                                                                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SDK import           | `SDK_MODULES`를 `shared/infra` 밖에서 import(테스트 제외). [Port·Adapter·DI](#portadapterdi)                                                                                                                                                                                                           |
| 클라이언트 모델      | `CLIENT_OWNED_MODEL_PATHS` 아래에서 `@aido/api` 루트·`contracts/*` import(테스트 제외). 메모는 `apis`·`schemas` 밖 전체가 대상이고, 목록에 없는 경로는 검사하지 않는다                                                                                                                                 |
| 스키마 폴더          | `SCHEMA_FOLDER_FEATURE_PATHS` 아래에서 `schemas/` 밖의 `zod` import(테스트·`__tests__` 제외). 옮긴 feature와 폴더만 대상이다                                                                                                                                                                           |
| 스키마 파일 이름     | `features/**/schemas/` 파일이 `-form`·`-params`·`-draft`·`-query-key`·`-storage`·`-request`·`-response`·`-payload`·`-entry`(`.schema.ts`) 밖의 이름. 모델은 `domains/{entity}.model.ts`로 옮긴다                                                                                                       |
| 엄격한 없음 비교     | 표시 없는 `=== null` 류. [nullish](../../../docs/conventions/nullish.md)                                                                                                                                                                                                                               |
| Hermes에 없는 메서드 | `toSorted`, `Array.fromAsync`. typecheck는 통과하고 호출한 순간 앱에서만 죽는다. `jest.setup.ts`도 Node에서 같은 것을 지운다                                                                                                                                                                           |
| 테스트 QueryClient   | 테스트에서 `new QueryClient`. `createTestQueryClient`를 쓴다                                                                                                                                                                                                                                           |
| 피처 경계            | 다른 피처를 상대 경로로 import                                                                                                                                                                                                                                                                         |
| `TodoCheckbox`       | `isChecked`·`onCheckedChange` 금지. 원본 `isSelected`·`onSelectedChange`를 쓴다                                                                                                                                                                                                                        |
| 댓글 feature         | [todo-comments](./todo-comments.md)의 경계. 금지 route, 식별자 props, 재수출, 인라인 query 옵션, 직접 `router.push`, 테스트 위치. `features/engagement/comment`와 할 일 상세 route에만 걸린다                                                                                                          |
| `core`·`shared` 층   | `core`가 `shared`·feature·`bootstrap`을, `shared`가 feature·`bootstrap`을 import(테스트 도구 제외). 허용 목록 없음                                                                                                                                                                                     |
| 위층 import          | [층과 의존](#층과-의존)에서 위층의 타입, 모델, `*-cache` 밖을 import. 층 표에 없는 feature도 거부                                                                                                                                                                                                      |
| 양방향               | 두 feature가 서로 import(타입 포함)                                                                                                                                                                                                                                                                    |
| 시트 route           | `SheetRouteScreen`을 그리는 `app/` route가 `safeParse` 결과의 `.data`를 읽음. route는 검증과 `Redirect`만, 대상은 시트가 route 훅으로 읽는다                                                                                                                                                           |
| 금지 이름            | `features`·`app`의 컴포넌트 이름이 `Body`, `Frame`, `Section`, `Blocks`, `Wrapper`로 끝남                                                                                                                                                                                                              |
| Policy Facade        | `XPolicy`의 별칭, 인라인 함수, 메서드, 모델의 `this`. feature `*.model.ts`가 `XPolicy`·타입 밖의 함수·상수를 export(상수는 `constants/`)                                                                                                                                                               |
| 함수 형태            | 모듈 수준 화살표·함수 표현식(테스트 제외), `xxxOf` 함수 이름. 허용 목록 없음                                                                                                                                                                                                                           |
| 함수 이름            | 값을 만드는 동사 뒤에 출처를 붙인 `getXFromY`·`toXFromY`·`useXFromY`류와 `tryX`(테스트 제외). `removeXFromY`처럼 동작이 일어나는 곳을 말하는 이름은 통과한다                                                                                                                                           |
| 파일 접두사          | feature 이름이 entity 이름을 줄인 것(`nudge`→`todo-nudge`)일 때 `schemas`·`domains`·`apis`·`queries`·`constants`·`__tests__`의 entity·feature 수준 파일(`*.model`·`*-cache`·`*.events` 등)이 줄인 이름으로 시작. 역할 이름 파일(`nudge-params.schema`)과 다른 entity(`nudge-interaction.*`)는 통과한다 |
| 타입 이름            | 폼 값 `*FormInput`(`*FormValues`로), `queries/*.mutations.ts`의 `*Params`·`*Args`(`*Variables`로). `Params`는 route 값에만 쓴다                                                                                                                                                                        |
| 테스트 mock          | 어댑터 테스트 밖의 모듈 `jest.mock`과 어댑터 테스트의 앱 모듈 mock. 허용 목록 없음                                                                                                                                                                                                                     |
| 분석 입구            | feature의 `useAnalytics`. `useTrack`만 쓴다                                                                                                                                                                                                                                                            |
| mutation 실패 처리   | `*.mutations.ts`의 `onError`에 함수를 넘김(`onError: showFailure`). 햅틱·토스트·보고는 그 자리에 나란히 적는다                                                                                                                                                                                         |
| 캐시 helper          | `queries/*-cache.ts`가 `core/events`·`ErrorReporter`·`Logger`·Service를 import. 이벤트 발행·보고·기기 저장은 호출부가 한다                                                                                                                                                                             |
| 기기 저장 읽기       | feature와 `app/`의 `useSyncStorageString`. 값의 repository가 읽기·쓰기·`subscribe`를 갖고 `useSyncExternalStore`로 구독한다. `shared/providers`와 테스트는 예외                                                                                                                                        |
| worklet 기본값       | `'worklet'` 함수의 매개변수 기본값(구조 분해 기본값 포함). Reanimated가 모듈 값을 잡아 주지 않아 UI 스레드에서 죽는다. 호출부가 값을 넘긴다                                                                                                                                                            |
| RN UI                | `react-native`의 `Image`, `ActivityIndicator`, `Alert.alert`                                                                                                                                                                                                                                           |
| 단계 렌더러          | `X.Render(...)` 함수 호출. `useStepper`의 `Render`는 훅을 쓰는 컴포넌트라 `<X.Render … />` JSX로만 그린다(React Compiler가 호출을 건너뛰면 훅 수가 달라진다)                                                                                                                                           |
| `Chip.Label`         | 앱 글꼴을 따르지 않는 `Chip.Label`. 글자는 자식 `<Text>`                                                                                                                                                                                                                                               |
| `Tabs.Label` 날글자  | 앱 글꼴을 따르지 않는 라벨 안의 글자. `SegmentTabTrigger`, `LineTabTrigger`나 자식 `<Text>`                                                                                                                                                                                                            |
| 화면의 역할 판별     | `domains/` 밖의 `=== USER_ROLE.X`, `=== PREMIUM_SOURCE.X`                                                                                                                                                                                                                                              |
| 쿼리 키 자리         | `constants/*query-keys.ts` 밖의 `queryKey: [`                                                                                                                                                                                                                                                          |
| 폼 모양              | `FormProvider`·`useFormContext`·`FormField`, 변수 이름 `form` 아님, `useForm` 제네릭. 폼은 `form`을 props로 넘기고 `Controller`로 쓴다                                                                                                                                                                 |
| 범위 비교 순서       | `x >= a && x <= b`류. 왼쪽에서 오른쪽으로 읽히게 `a <= x && x <= b`로 쓴다                                                                                                                                                                                                                             |
| 판별 이름            | 선언 이름 `isNot*`, `hasNo*`, `is*Allowed`, `is*Eligible`. 가져온 라이브러리 이름과 구조 분해한 계약 필드, OS 상태 `isNotDetermined`은 예외                                                                                                                                                            |
| 여백 표기            | 한 태그에 spacing prop(`p`, `px`, `pb` 등)과 `className`을 함께 씀. 여백은 `className`으로 쓴다(`gap`·`flex` prop은 대상이 아니다)                                                                                                                                                                     |
| 아이콘 prop          | `StyledIcon`·`typeof XIcon` 타입 prop의 이름이 `Icon`(또는 `XIcon`)이 아님. 컴포넌트는 `Icon: StyledIcon`, 그려 둔 요소는 `icon: ReactNode`                                                                                                                                                            |
| 로딩 조각 이름       | 네임스페이스에 거는 `X.YSkeleton`. `X.Loading`(행마다면 `X.Item.Loading`)으로 건다                                                                                                                                                                                                                     |
| 조각 함수 이름       | `X.Y = function Z`에서 `Z`가 `Y`와 다름. `.Error`는 `ErrorFallback`, 가져온 이름을 가리면 다른 이름. 테스트 mock은 예외                                                                                                                                                                                |

**이미 있는 위반:** 허용 목록(`scripts/mobile-conventions-allowlist.json`)에는 끊지 못한 양방향 쌍(`feature-bidirectional`) 하나(`planning/category <-> planning/todo`)만 이유와 함께 남았다. 나머지 규칙의 허용 목록은 비었다. 수를 넘으면 막고, 수가 줄면 목록도 줄이라고 실패한다. 고친 뒤 `pnpm check:conventions --shrink-allowlist`로 줄인다. 이 명령은 수를 줄이거나 항목을 지우기만 하고 새 위반을 넣지 않는다. 새 항목은 이유와 함께 직접 적는다.

아래 규칙은 이 검사가 막지 않아 리뷰로 지킨다: Facade 밖에서 부르지 않는 메서드, 메모 밖 feature의 계약 import, 쿼리·utils 파일 위치, 다른 feature의 `apis/` import.

## 아직 옮기지 않은 것

이 문서의 규칙은 옮긴 뒤의 모양이다. 지금 코드가 다른 곳을 적는다(2026-11-08 `check:conventions`와 grep 기준). 고칠 때 규칙 쪽으로 옮기고 이 표에서 지운다. 검사가 세는 양방향 쌍의 목록은 `scripts/mobile-conventions-allowlist.json`에 있다.

| 규칙                    | 지금 코드                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [사용성](#사용성)       | `AddFriendForm`(RN `ScrollView` + `keyboardShouldPersistTaps="always"`). 코드로만 확인했고 기기 재현은 안 했다                                                                                                                                                                                                                                                                                                                                         |
| [모델](#모델과-policy)  | 모델 스키마는 모두 `domains/`에 있다(`schemas/`의 역할 접미사 밖 파일 0개). 모델 파일 4개가 `schemas/`의 폼·요청·푸시 모양을 import한다: `notification.model.ts`(`PushNotificationPayload`·`NotificationNavigation`), `voice-note.model.ts`(`planReviewDraftSchema`), `todo-comment-composer.model.ts`(`TodoCommentComposerMode`·`TodoCommentChainInput`), `todo-change.model.ts`(`TodoUpdateChanges`). 손댈 때 모델 모양으로 정의하고 mapper가 바꾼다 |
| [층과 의존](#층과-의존) | 양방향 1쌍 `planning/category <-> planning/todo`. 카테고리 변경마다 다시 받는 할 일 범위가 달라 `meta` 태그 하나로 묶으면 범위가 바뀌고, 이벤트는 갱신을 mutation 밖으로 숨긴다. 이유는 허용 목록에 있다. 허용 외 위층 import 없음                                                                                                                                                                                                                     |
| 테스트·UI               | [testing-guide](./testing-guide.md#아직-옮기지-않은-것), [ui-components](./ui-components.md#아직-옮기지-않은-것)                                                                                                                                                                                                                                                                                                                                       |

---

## 사용성

코드 구조보다 사용성이 먼저다. 구조를 고치다 사용성이 나빠지면 구조를 양보한다.

| 상황                       | 기대                                                    | 쓰는 것                                                                                                                                                    |
| -------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 입력칸을 누름              | 칸과 오류 문구가 키보드 위에 보임                       | 폼 `FormStepLayout`·`FormScrollView`(칸 전체 스크롤), 전체 화면 입력 `KeyboardAvoidingView behavior="padding" automaticOffset`, 시트 `KeyboardBottomSheet` |
| 저장 버튼                  | 키보드에 가리지 않음                                    | `KeyboardAdaptiveButton`, 시트 `footer`                                                                                                                    |
| 키보드가 열린 채 버튼 탭   | 첫 탭에 바로 동작                                       | 스크롤 폼·검색 `keyboardShouldPersistTaps="handled"`. 칩 줄, 시트, 댓글 작성처럼 입력을 이어 가는 곳만 `"always"`                                          |
| 키보드를 따라 움직임       | 실제 키보드 위치와 같이 움직임                          | `react-native-keyboard-controller`. `Keyboard.addListener` + 타이밍으로 위치를 흉내 내지 않는다                                                            |
| 키보드의 다음·완료 키      | 다음 칸 이동 또는 제출                                  | `returnKeyType`, `onSubmitEditing`, `setFocus`                                                                                                             |
| 이메일·비밀번호            | 맞는 키보드와 자동 완성                                 | `keyboardType`, `textContentType`, `autoComplete`                                                                                                          |
| 검증 실패                  | 틀린 칸으로 포커스                                      | `Controller`의 `field.ref`                                                                                                                                 |
| 시트 위에 피커를 열고 닫음 | 키보드 내린 뒤 열림, 닫으면 입력으로 포커스 복귀        | `ModalBottomSheet`가 열릴 때 키보드를 내린다. 복귀는 `onCloseStart`에서 한다([시트](./ui-components.md#시트))                                              |
| 저장 중·실패               | 중복 제출 없음, 성공 전에 닫지 않음, 실패해도 글자 유지 | `isSubmitting`, `isPending`, 초안                                                                                                                          |
| 큰 글꼴·긴 문구·작은 화면  | 주요 버튼에 닿을 수 있음                                | 스크롤 가능한 틀, `useFontScaledSize`                                                                                                                      |
| 뒤로 가기                  | 작성 중 글자를 잃지 않음                                | 초안 또는 확인                                                                                                                                             |

화면을 끝내기 전에 주요 흐름 한 번, 실패와 재시도 한 번, 키보드, 뒤로 가기, 긴 문구, 큰 글꼴을 직접 해 보고 실행한 것과 못 한 것을 나눠 보고한다.

---

## 화면

`app/`의 화면은 위에서 아래로 읽힌다. 파일을 열면 화면 순서, 간격, 글자, 로딩·오류 경계가 그대로 보여야 한다. 줄이 길어도 쪼개지 않는다.

기준은 frontend-fundamentals-mock-exam-1이다. 파일 구조는 따르지 않고 서비스는 우리 DI로 받는다. 같은 역할의 앱 코드는 다음과 같다.

| 참고 저장소                                | 앱                                                                      |
| ------------------------------------------ | ----------------------------------------------------------------------- |
| `SavingsCalculatorPage`                    | `app/(app)/(tabs)/memo/index.tsx`                                       |
| `ProductList`(`.Item`·`.Loading`·`.Error`) | `MemoList`                                                              |
| `CalculationResult`(`.Contents`, `Record`) | 선택 없음은 `MemoEditor.Empty`, 좁혀진 id는 `useMemoId`로 읽음          |
| `AmountInput`                              | `Omit<ComponentProps<typeof 원본>, …>` 확장(`MemoActionButton`)         |
| `saving-product.model.ts`                  | `memo.model.ts`. 단, 참고 저장소의 Policy 인라인 메서드는 따르지 않는다 |

```tsx
// app/(app)/(tabs)/memo/index.tsx
<AdaptivePane
  primary={
    <Box className="flex-1">
      <StyledSafeAreaView edges={['left', 'right']}>
        <HStack align="center" gap={8} className="px-4">
          <Box className="flex-1">
            <H3 numberOfLines={1}>{t('tab.title')}</H3>
          </Box>
          <VoiceNoteStartButton />
          <QueryErrorBoundary fallback={MemoCreateButton.Error}>
            <Suspense fallback={<MemoCreateButton.Loading />}>
              <MemoCreateButton />
            </Suspense>
          </QueryErrorBoundary>
        </HStack>

        <Spacing size={16} />
      </StyledSafeAreaView>

      <MemoListScrollView>
        {/* 초안이 없는 사용자가 대부분이라 로딩·실패 때 자리를 잡지 않는다. 자리를 잡으면 아래 메모가 위로 밀린다 */}
        <QueryErrorBoundary fallback={() => null}>
          <Suspense fallback={null}>
            <VoiceNoteDraftList />
          </Suspense>
        </QueryErrorBoundary>

        <QueryErrorBoundary fallback={MemoList.Error}>
          <Suspense fallback={<MemoList.Loading />}>
            <MemoList />
          </Suspense>
        </QueryErrorBoundary>
      </MemoListScrollView>
    </Box>
  }
  secondary={…}
/>
```

- `QueryErrorBoundary`·`Suspense`·`Spacing`을 스크린에 그대로 나열한다. 조각 안으로 숨기지 않는다.
- 화면 제목, 구역 제목, 안내 문구처럼 화면 구성을 설명하는 글자와 그 레이아웃도 스크린에 적는다. 글자 한 줄을 감싼 지역 컴포넌트를 만들지 않는다. 데이터에 따라 달라지는 글자만 해당 컴포넌트 안에 둔다(`MemoList`의 `list.savedTitle`).
- 스크린에 남겨도 되는 것은 `match`와 짧은 route 처리다. 폼과 제출, 긴 effect, 큰 조각은 그 역할을 맡는 컴포넌트로 옮긴다([폼](#폼)).
- 넘기기용 래퍼(`Content → Header → Section`)를 만들지 않는다. 화면 전체를 피처 `pages/`로 옮겨 재수출하지 않는다.
- JSX 상수(`const waveform = …`)로 화면 구조를 숨기지 않는다.
- 상태별 화면은 `match(view).with(…).exhaustive()`로 스크린에서 고른다.
- fallback은 `fallback={X.Error}`, `fallback={<X.Loading />}`로 건다. 화살표로 감싸지 않는다. 시트 안 경계만 닫기 핸들러를 넣어야 해서 `fallback={(fallbackProps) => <X.Error {...fallbackProps} onInquiry={…} />}` 한 모양으로 감싼다([QueryErrorBoundary](../src/shared/ui/query-error-boundary/query-error-boundary.md#기능-fallback의-다시-시도--문의하기)). 인라인 `Result`를 두지 않고 `X.Error` 조각으로 뺀다. `X.Loading`이 있으면 `X.Error`도 짝으로 두고 남의 `.Error`(`SettingsListGroup.Error`)를 경계에 직접 빌리지 않는다. 모양이 같으면 `X.Error = SettingsListGroup.Error`로 잇는다. `.Error`가 없으면 경계 기본 fallback(다시 시도 + 문의하기)을 쓴다. 대부분 안 보이는 블록처럼 자리를 잡으면 오히려 밀리는 경우만 `fallback={null}`, `() => null`을 쓰고 위 예처럼 이유를 주석으로 남긴다.
- 경계를 나눌 때는 한 오류가 한 곳에서만 보이는지, 로딩 모양이 지금과 같은지 먼저 확인한다. 같은 쿼리를 두 경계에서 읽으면 404가 두 번 보이므로 나누지 않는다.
- 바깥 여백은 스크린의 `Spacing`이다. `mb`·`mt` 같은 여백 prop을 블록에 넘기지 않는다.
- 스스로 숨는 블록은 간격도 함께 사라져야 한다. 조건을 스크린에서 알 수 있으면 `{isAvailable && (…)}` 안에 간격과 블록을 함께 둔다. 조회해야 알 수 있는 카드만 스크린이 `className`으로 넘긴다(`<PushPermissionNotice className="mx-4 mb-3" />`).
- 빈 줄로 구역을 나눈다.
- 가상 목록의 `ListHeaderComponent` 안에도 카드·정렬 바·구분선을 직접 적는다. 헤더를 목록 밖으로 옮기면 스크롤과 첫 위치가 바뀐다. `header`·`ListHeaderComponent`는 자리가 정해진 슬롯이라 이름만 보고 없애지 않는다.
- 데이터를 보여 주는 화면은 로딩·오류·빈 상태·데이터 4상태를 그린다. 저장 실패는 입력값을 지우지 않는다.

Suspense 조회나 파라미터 검증 때문에 부모가 꼭 필요하면 route가 검증과 경계만 맡는다. 경계를 없애려고 query hook을 자기 Suspense 위로 옮기거나 경계를 내비게이터 전체로 넓히지 않는다.

```tsx
// app/(app)/memo/[memoId]/index.tsx
export default function MemoDetailRoute() {
  const params = memoParamsSchema.safeParse(useLocalSearchParams());
  const goBack = useSingleTap(router.back);

  if (!params.success) {
    return <Redirect href="/memo" />;
  }

  return (
    <StyledSafeAreaView edges={['left', 'right']} className="flex-1 bg-white">
      <QueryErrorBoundary resetKeys={[params.data.memoId]} fallback={MemoEditor.Error}>
        <Suspense fallback={<MemoEditor.Loading />}>
          <MemoEditor toolbar={MemoEditor.StackToolbar} onLeave={goBack} />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
}
```

---

## 컴포넌트

### 컴포넌트 계약

**추출은 추상화가 아니다.** JSX를 다른 파일로 옮기기만 하면 읽는 사람이 파일을 오갈 뿐 변경 이유는 줄지 않는다.

| 쓰는 곳                    | 둘 곳                                     |
| -------------------------- | ----------------------------------------- |
| 한 곳                      | 그 파일 아래 지역 컴포넌트                |
| 두 곳 이상, 같은 피처      | 피처 `components/`의 독립 파일            |
| 부모 없이 의미 없는 조각   | 부모 파일의 네임스페이스(`MemoList.Item`) |
| 함께 바뀌는 목록·행·작성기 | 같은 하위 폴더                            |

hook과 유틸도 같은 기준이다. 한 파일만 쓰면 그 파일 아래 지역 hook·함수이고, `shared`는 두 피처 이상이 쓸 때만 둔다. 업무 규칙만 쓰는 곳과 상관없이 `domains/*.model.ts`로 모은다. 파일이 길다는 이유로 나누지 않는다. 한 컴포넌트·hook이 여러 책임을 지면 같은 파일 안에서 책임별 지역 hook·지역 컴포넌트·네임스페이스로 나눈다(`MemoEditor`, `useVoiceCaptureSession`).

**데이터는 쓰는 컴포넌트가 조회한다.** 화면이 조회해 Props로 내리면 Suspense 경계를 블록 단위로 나눌 수 없다. 지역 컴포넌트에 좁힌 값을 넘기는 것은 괜찮다(`MemoList.Item`의 `memo`). 목록의 재사용 인터페이스(`filters`, `orderBy`, `limit`)는 실제 쓰는 곳이 있을 때만 둔다. 안 쓰는 옵션은 만들지 않는다.

**화면 id는 route hook에서 읽는다.** `todoId`, `friendId`, search param을 Props로 내리지 않는다. 검증된 튜플 훅(`const [memoId] = useMemoId()`)이나 `useRouteParams`에서 직접 읽는다. 예외는 목록 행의 id다.

반복되는 목록 아이템(달력 칸 등)은 부모가 route 훅을 한 번 읽어 파생 값(`isSelected` 등)과 같은 핸들러를 props로 받는다. 아이템마다 route 훅을 부르지 않는다(마운트·리렌더 비용).

```tsx
// features/notes/memo/components/memo-editor.tsx
function MemoDeleteDialog({ isOpen, onOpenChange, onDeleted }: MemoDeleteDialogProps) {
  const { t } = useTranslation(['memo', 'common']);
  const [memoId] = useMemoId();
  const deleteMemo = useMutation(useDeleteMemoMutationOptions());
```

선택된 대상을 보여 주는 화면은 스크린이 튜플 훅으로 id를 읽어 `== null`이면 `.Empty`를 그리고, 안쪽 컴포넌트는 route hook으로 좁혀진 id를 읽는다(`MemoScreen`, `MemoEditor`). 스크린이 고르지 않으면 바깥 컴포넌트가 `.Empty`를 돌려주고 좁힌 id를 `.Contents`에 넘긴다(참고 저장소 `CalculationResult.Contents`).

대상이 있는 시트(할 일·하위 항목·카테고리·제안)는 Expo Router 시트 route로 띄운다. 시트가 route hook으로 id를 읽어 캐시에서 조회한다. 폼 상태에 묶인 피커처럼 route 문맥이 없어 `useOverlay`로 띄우는 시트만 값을 Props로 받는다. 계약: `src/shared/ui/bottom-sheet/bottom-sheet.md`.

**컴포넌트는 바깥 레이아웃을 모른다.** 루트에 margin·폭·위치를 두지 않는다. 카드 자신의 모양(`rounded-2xl bg-gray-1`)과 안쪽 여백은 컴포넌트 몫이다.

**Props는 예측할 수 있게 쓴다.** 원본을 확장하면 `Omit<ComponentProps<typeof X>, …>`로 원본 이름을 살린다. `ReturnType<typeof useX>`로 props를 만들지 않고 인터페이스를 적는다.

**원본 이름을 접미사로 쓴다.** heroui-native 부품이나 `shared/ui` 부품을 확장하면 파일은 `{역할}-xxx.tsx`, 컴포넌트는 `{역할}Xxx`다(`unread-notification-card.tsx`). `Card`, `Chip`, `Popover`, `Dialog`, `Alert`, `Tabs`, `Menu`, `Avatar`, `Skeleton`, `Separator`, `Button`은 원본 이름이 접미사다. `RadioGroup`·`InputOTP`은 `{역할}-input.tsx`로 쓰고 `value`·`onValueChange`를 지킨다. `PressableFeedback`은 동작만 주므로 `{역할}-button.tsx`나 `{역할}-row.tsx`다. 이름이 `*-card`이면 heroui `Card`를 쓰고, 목록 행이면 `-row`로 쓴다.

```tsx
// features/notes/memo/components/memo-editor.tsx
interface MemoActionButtonProps extends Omit<ComponentProps<typeof PressableFeedback>, 'children'> {
  icon: ReactNode;
  accessibilityLabel: string;
}
```

| 대상                                      | 이름                                          |
| ----------------------------------------- | --------------------------------------------- |
| shared `Input`·`TextArea`                 | `value`/`onChange(text)`                      |
| HeroUI `Checkbox`·`Switch`·`ControlField` | `isSelected`/`onSelectedChange`, `isDisabled` |
| `RadioGroup`                              | `value`/`onValueChange`                       |
| 시트·다이얼로그                           | `isOpen`/`onOpenChange`                       |

`disabled`·`selected`·`onToggle`처럼 같은 뜻의 다른 이름을 만들지 않는다.

**래퍼는 역할이 있을 때만 만든다.** 참고 저장소의 `AmountInput`(단위 suffix·숫자 포맷), 앱의 `MarketingPushOptInBottomSheet`(도메인 문구·동의 저장)처럼 자기 일이 있어야 한다. 역할이 없으면 원본을 쓴다. 상세: [Wrapper Props 계약](./ui-components.md#wrapper-props-계약).

**행의 현재 값은 값만 그리는 컴포넌트가 읽는다.** 메뉴 행의 값(친구 수, 알림 켜짐·꺼짐, 요금제)은 `FriendCountValue`처럼 값 하나만 그리는 컴포넌트가 기존 쿼리를 직접 읽고, 자기 `QueryErrorBoundary`·`Suspense`를 `fallback={null}`로 가져 메뉴를 막지 않는다. 어떤 값을 보일지 판단은 view-model 순수 함수(`toPlanTypeLabelKey`)다.

**반복 UI는 나란히 쓴다.** 항목마다 기획이 따로 바뀔 수 있는 표시는 설정 배열을 `map`하지 않고 `CalculationResult`의 `<Record />`처럼 한 줄씩 적는다. 한 줄만 고치면 되게 한다. 서버 항목처럼 데이터로 오는 목록은 `map`·`FlashList`다. 상수로 개수가 정해지는 반복(스켈레톤, `InputOTP.Slot`)은 es-toolkit `range(n).map`이다.

**네임스페이스는 응집도로 정한다.** `Item`·`Loading`·`Error`·`Empty`는 필수가 아니다. 쓰지 않는 static을 만들지 않는다. 부모에 강하게 결합된 조각(`DailyForecast.TemperatureBar`, `PushPermissionNotice.Ask`)도 같은 방식으로 둔다. 파일 안 순서는 본체 → 구성 요소 → `.Loading` → `.Error` → `.Empty`다. 단계별 조각은 본체가 Policy의 step을 `match(step)….exhaustive()`로 고른다.

**자리는 같고 구현이 갈리면 컴포넌트를 prop으로 넘긴다.** `MemoEditor`는 넓은 화면 pane과 Stack 화면에서 툴바만 다르다. `mode`로 분기하지 않고 인터페이스 하나를 받는다(`toolbar={MemoEditor.StackToolbar}`, `toolbar={MemoEditor.PaneToolbar}`).

**변환은 es-toolkit으로 의도를 드러낸다.** `groupBy`, `keyBy`, `partition`, `sumBy`, `maxBy`, `orderBy`, `uniqBy`, `clamp`, `range`를 쓴다. 변환은 view-model·utils의 순수 함수에 두고 화면은 결과만 그린다(`notification/utils/date-section.ts`). 상호 배타적인 상태는 ts-pattern `match(…).exhaustive()`다. 단순 표시 여부나 두 가지 문구는 `&&`·삼항식이면 된다.

### 이름

자세한 표는 [ui-components](./ui-components.md#이름)에 있다.

- 원본을 확장하면 원본 이름으로 끝난다(`AmountInput`, `XBottomSheet`, `XDialog`, `XChip`). 그 외에는 대상과 역할이다(`MemoList`, `MemoEditor`).
- 쓰지 않는 이름: `Section`, `Body`, `Frame`, `Wrapper`, `Inner`, 역할 없는 `Content`. 위치만 뜻해 변경 이유를 알려 주지 않는다. `X.Contents`는 null을 좁혀 넘길 때만 쓴다.
- 함수는 동사로 시작한다. 변환은 `toX`(`toMemo`), 생성은 `createX`(`createMemoDraftKey`), 불변 갱신은 `withX`다. `xxxOf`, `xxxFrom`, 대상 없는 `process`, `doX`, `runX`는 쓰지 않는다.
- 저장 키, Analytics 이벤트, 서버 필드처럼 밖으로 나가는 문자열은 이름 정리 대상이 아니다.

**판별 함수 접두사.** 같은 뜻은 한 접두사만 쓴다. 판별은 부수효과 없이 boolean만 돌려준다.

| 접두사    | 묻는 것                                        | 예                                       |
| --------- | ---------------------------------------------- | ---------------------------------------- |
| `can*`    | 사용자가 이 동작을 해도 되나(권한, 한도, 상태) | `canCreateMemo`, `canEditComment`        |
| `should*` | 앱이 스스로 이 일을 할 때인가                  | `shouldOfferPremium`, `shouldAutoFinish` |
| `is*`     | 지금 상태나 분류                               | `isExpired`, `isAdmin`                   |
| `has*`    | 가진 것, 존재, 이미 일어난 일                  | `hasSubTodos`, `hasChanged`              |

- 부정 이름(`isNot*`, `hasNo*`)은 쓰지 않고 긍정으로 짓는다. `isXAllowed`, `isXEligible`, `isXLocked`, `isXBlocked`처럼 허용을 묻는 판별은 `can*`이다. 앱의 자동 판단은 `can*`이 아니라 `should*`다.
- 안내를 띄우거나 이동하는 함수는 판별이 아니다. `promptIf*`로 부수효과를 드러내고 true는 "안내를 띄웠다, 멈춘다"다(`gate.promptIfBlocked`, `gate.promptIfBlockedError`). 처리했는지 돌려주는 함수는 true가 "내가 처리했다"다(`interceptBack`). `ensure*`는 true가 통과다. 한 호출부 안에서 true의 뜻이 섞이지 않게 한다.
- 불리언을 담은 ref는 `*Ref`로 끝낸다(`isRequestingRef`). `.current`를 빠뜨려도 항상 참이 되는 결함을 막는다.
- 값을 돌려주는 동사도 종류마다 하나다: `get*`(읽기, 파생), `calculate*`(계산), `find*`(없으면 `null`), `create*`, `to*`(변환), `format*`(표시 문자열), `parse*`(실패 시 `null`). 인자가 목표값이면 `toggle`이 아니라 `set*`이나 `with*`다.
- 같은 종류의 함수는 같은 실패 표현을 쓴다. Repository 읽기와 파서는 없으면 `null`, Service는 `Result`다.
- 예외: 서버 계약 필드와 라이브러리 이름(`permissions.canEdit`, `isLoading`, `hasNextPage`), OS 상태 이름(`isNotDetermined`), 라이브러리 콜백 규약(`BackHandler`의 true, `onBeforeOpen` 같은 prop이 정한 뜻).
- Policy Facade 키도 같은 접두사를 따르고 export한 함수 이름 그대로다. Policy에는 업무 판별만 두고, 표시용 판별(`isChecklistVisible` 같은 화면 값)은 Policy에서 뺀다.

### 목록·스켈레톤

**목록 도구**

- `FlashList`와 `.map`을 고르는 기준은 [ui-components](./ui-components.md#목록-flashlist와-map)에 있다.
- 공용 목록은 원본 계약을 확장한다. `UserList`는 `FlashListProps`에 `hasNextPage`·`isFetchingNextPage`·`fetchNextPage`(TanStack 이름)와 `refreshing`·`onRefresh`(RN 이름)만 더한다.

**목록 컴포넌트**

- 자기 데이터를 `useSuspenseQuery`·`useSuspenseInfiniteQuery`로 구독한다.
- 원본을 그대로 넘기는 `X.Item = (props) => <UserList.Item {...props} />`을 만들지 않는다. 같은 fallback은 `X.Error = UserList.Error`처럼 참조로 잇는다.

```tsx
// features/notes/memo/components/memo-list.tsx
MemoList.Loading = function Loading() {
  const columnCount = getColumnCount(useWindowSizeClass());

  return (
    <HStack gap={12} align="start">
      {range(columnCount).map((column) => (
        <VStack key={column} flex={1} gap={12}>
          {range(LOADING_ITEMS_PER_COLUMN).map((row) => (
            <VStack key={row} gap={8} p={16} className="rounded-2xl bg-gray-1">
              <TextSkeleton size="b3" className="w-full" />
              <TextSkeleton size="b3" className="w-3/4" />
              <TextSkeleton size="e1" className="w-1/2" />
            </VStack>
          ))}
        </VStack>
      ))}
    </HStack>
  );
};
```

### 레이아웃 시프트

받은 뒤에 화면이 밀리지 않게 자리를 먼저 잡는다.

| 지점                                     | 규칙                                                                                                                                     |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `X.Loading`                              | 받은 뒤 화면과 같은 레이아웃·슬롯·높이. 글자는 `TextSkeleton size`(현재 글꼴 배율의 줄 높이), 행 텍스트는 `ListRow.Texts.Loading`        |
| 데이터에 따라 생기는 줄(설명, 하위 항목) | 로딩에서 그리지 않아 끝날 때 위 내용이 밀리지 않게 한다                                                                                  |
| 받은 뒤 나타나는 버튼·배너               | 자리를 먼저 비워 두거나(`MemoCreateButton.Loading`, `MemoEditor.PaneLoading`의 버튼 줄), 대부분 안 보이면 자리를 잡지 않고 이유를 적는다 |
| 오류 문구                                | `preserveErrorSpace`로 자리 유지. 입력 칸이 밀리지 않는다                                                                                |
| 이미지·아이콘                            | 크기 고정. 글꼴 배율은 `useFontScaledSize`, 칩은 `ActionButton.Icon`                                                                     |
| 재조회                                   | 화면에 데이터가 있으면 fallback으로 바꾸지 않는다. 키가 바뀌는 전환은 `startTransition`을 검토한다                                       |
| 시트                                     | 내용 높이 변화는 기존 시트 측정을 쓴다. 키보드는 `KeyboardBottomSheet`, `react-native-keyboard-controller`                               |
| 넓은 화면 전환                           | `AdaptivePane`으로 재마운트 없이 유지                                                                                                    |
| 부품 교체, 간격 변환                     | 전후 화면을 겹쳐 비교한다. 달라지면 교체하지 않거나 값을 맞춘다                                                                          |

대표 화면을 로딩 중과 완료 후로 찍어 위치를 비교한다. 작은 화면, 글꼴 5단계, 넓은 화면, 다크, 한/영에서 본다.

### 훅

- `useForm`·`useQuery`·`useMutation`은 쓰는 컴포넌트에서 직접 호출한다. Screen을 짧게 하려고 `useEditor`·`useActions` 같은 포괄 훅에 묶지 않는다.
- 훅은 변화 이유가 하나다(route 읽기, 전환 조정, field focus). 계산은 순수 함수·Policy로 뺀다. 이름 변경이나 코드 이동은 단일 책임이 아니다.
- 훅은 상태·effect·구독을 묶거나 여러 곳이 같은 규칙을 공유할 때만 만든다. 한두 줄을 감싸는 훅이나 파일을 짧게 하려는 훅은 만들지 않는다. `requestAnimationFrame(() => setFocus('title'))`처럼 몇 곳에 반복돼도 짧으면 쓰는 곳에 그대로 쓴다.
- 사용처가 같으면 한 파일이다(`hooks/use-memo-params.ts`). 한 곳에서만 쓰면 그 컴포넌트 파일 안이다(`useMemoAiParse`).
- 입력을 여는 칩·행은 시트가 넘긴 `form`을 props로 받아 `useWatch`·`Controller`로 직접 읽고 쓰며 시트도 직접 연다. 부모에 핸들러를 두고 `value`·`onChange`·`onCloseStart`를 내려보내지 않는다. Props는 부모만 아는 값과 원본 컴포넌트의 props만 받는다. 부모도 같은 동작을 불러야 하면 부모가 소유하고 원본 prop(`onPress`)으로 넘긴다.
- 상태 훅과 route 훅은 항상 튜플을 돌려준다. 값 하나면 `[value, setValue]`, 여러 값이면 `[{ a, b }, setValues]`이고 읽기 전용이어도 세터 없는 튜플이다(`const [todoId] = useTodoId()`). 저장소가 URL·MMKV·`useState` 중 무엇이어도 훅 반환만 고치면 사용처는 그대로다. 이름은 값을 드러낸다(`[selectedMemoId, setSelectedMemoId]`). 저장소가 없는 계산·구독 값(`useIsOnline`, `useTemperatureUnit`)과 동작 묶음은 튜플이 아니다.
- 쓰지 않는 요소는 비워 두지 않고 `_`를 붙인다(`const [_selectedMemoId, setSelectedMemoId]`).

### Context 대신 쓰는 것

앱이 만드는 Context는 DI와 라이브러리처럼 동작하는 UI 내부 구현에만 남긴다. Context는 값이 바뀔 때 소비자 전체가 다시 그려지고 의존이 타입에 안 보이기 때문이다. 나머지는 아래 순서로 고른다.

| 순서 | 수단                                            | 언제                                                                                               | 예                                                               |
| ---- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1    | props                                           | 부모만 아는 값, 한두 단계                                                                          | `onLeave`, `isEditing`                                           |
| 2    | 컴포넌트를 prop으로                             | 자리는 같고 구현이 갈릴 때. 인터페이스 하나                                                        | `fallback={MemoList.Error}`, `toolbar={MemoEditor.StackToolbar}` |
| 3    | Query 캐시, `useIsMutating`, `useMutationState` | 서버 값과 진행 상태를 떨어진 곳에서 읽을 때                                                        | `MemoAiParsingBadge`의 `useIsMutating`                           |
| 4    | route 훅                                        | URL에 남는 값                                                                                      | `useMemoId`, `useSelectedMemoId`                                 |
| 5    | 외부 저장소 + `useSyncExternalStore`            | 앱 전역 설정, 기기 저장 값. Provider가 필요 없고 해제는 React가 맡는다                             | `minute-clock-store.ts`, `accessibility-setting-store.ts`        |
| 6    | 폼은 props                                      | `FormProvider`는 쓰지 않는다. 칩처럼 `setValue`, `setFocus`까지 쓰면 `form`, 읽기만 하면 `control` | `TodoComposerChips form={form}`, 메모는 `control`                |

**유지하는 Context:** `di-context`, `shared-di-context`(`shared`가 쓰는 포트만 나눈 DI), `overlay-provider`, `overlay-state-context`, `grid`, 시트 내부(`portal-target`, `sheet-footer-slot`, `sheet-header-layout`, `keyboard-bottom-sheet`), 댓글 폼(`todo-comment-form-context`), 키보드 위 칸 맞춤(입력과 버튼은 기능 폼 여러 층 아래에 있어 props로 내릴 수 없다. `focused-field`: 입력이 칸 전체 뷰를 시트·화면 폼 스크롤에 알린다, `keyboard-footer-height`: 키보드 버튼이 제 높이를 화면 폼에 알린다. 둘은 바뀌지 않는 알림 함수라 소비자가 다시 그려지지 않는다. `field-max-height`: 키보드 시트가 자라는 `TextArea`에 칸 상한 함수를 준다. 키보드가 오르내릴 때만 바뀌고 그때 칸이 다시 잰다).

**UI 내부 Context의 예, 댓글 폼:** 작성 바, 댓글 행, 뒤로 가기가 한 입력값을 읽고 바꾸고, 세션이 폼을 소유한다. 폼은 props로 내리면 작성 바와 행 사이의 여러 층을 거쳐야 하고, 이 Context는 `UseFormReturn` 하나만 나눠 주며 서버 값이나 앱 상태를 담지 않는다. 폼의 값 변화는 `useWatch`가 구독하므로 Context 값(폼 객체)은 바뀌지 않아 소비자가 다시 그려지지 않는다.

**판단해 남긴 Context** (옮기기 전에 전후 동작을 확인한다. 동등하지 않으면 유지하고 이유를 남긴다):

| Context                                                      | 판단                                  | 근거                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `theme-provider`, `font-scale-provider`, `language-provider` | 유지(저장소는 `useSyncStorageString`) | 값의 원천은 `ObservableSyncStorage` 하나다. 셋은 DI 위에 있어 `syncStorage` prop(기본 `deviceSyncStorage`)을 `useSyncStorageString(storage, key)`에 넘기고, 파생(해석·적용)만 Provider가 한다. 키(`aido_theme_mode`, `aido_font_scale`, `aido_language`)와 값은 그대로다                                     |
| `local-date-provider`                                        | 유지                                  | 저장 값이 아니라 자정 타이머·AppState·기기 달력에서 파생한 상태의 단일 소유자다. 원천이 MMKV가 아니다                                                                                                                                                                                                        |
| `keyboard-bottom-gap-provider`                               | 유지                                  | 하위 트리마다 `measureInWindow`로 잰 레이아웃 값이다. 저장소가 아니라 서브트리 범위 값이다                                                                                                                                                                                                                   |
| `todo-comment-expansion`                                     | 유지(UI 내부)                         | 댓글 세션 하나의 펼친 묶음 `Map`이다. 묶음 행과 작성 바(게시하면 그 묶음을 펼친다)가 `FlashList` 행 안팎에서 함께 쓰고 세션이 끝나면 사라져야 한다. props로는 목록·행·답글 여러 층을 거치고, 모듈 저장소는 세션(넓은 화면 pane과 Stack 화면)마다 나뉘지 않고 화면을 떠나도 남는다. 서버 값도 URL 값도 아니다 |
| `todo-comment-reveal`                                        | 유지(UI 내부)                         | 목록·작성 바 ref, Reanimated 공유 값, 키보드 이벤트 뒤 `measureInWindow`로 재는 스크롤 동작을 나눈다. 값은 바뀌지 않는 ref와 함수라 소비자가 다시 그려지지 않는다. `keyboard-bottom-gap-provider`처럼 서브트리 범위의 레이아웃 값이다                                                                        |

### 함수 형태

| 위치                                                              | 형태                                           | 예                                                                |
| ----------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------- |
| 컴포넌트, 훅, 순수 함수, mapper, query options, `select`, fixture | `function` 선언                                | `export function toMemo(dto) {}`, `function selectMemos(data) {}` |
| 네임스페이스 조각                                                 | 이름 있는 함수 표현식                          | `MemoList.Item = function Item() {}`                              |
| Service 메서드                                                    | arrow class field. DI로 넘겨도 `this`가 유지됨 | `getMemo = async () => {}`                                        |
| 컴포넌트 안 핸들러                                                | 화살표 `const`                                 | `const handleBack = () => {}`                                     |
| 인라인 콜백, 쿼리 키 객체 값                                      | 화살표                                         | `onPress={() => …}`, `detail: ({ memoId }) => […]`                |
| Policy Facade                                                     | 이름 있는 함수 참조만                          | `{ canCreateMemo }`                                               |

### 유틸 이름과 인터페이스

`utils/`는 입력만으로 결과를 내는 순수 함수다.

- 파일: export가 하나면 파일 이름이 함수 이름 kebab-case다(`to-screen-name.ts`). 같은 대상의 묶음은 `{대상}.ts`나 정해진 접미사(`{feature}-draft`, `{feature}-analytics`, `{name}.geometry`, `{name}.view-model`)다. `helpers`, `utils`, `common`, `misc`는 쓰지 않는다. 저장소는 `*-store.ts`(`shared/stores/`)이고 `hooks/`에는 `use-*`만 둔다.
- 함수: 동사로 시작한다(`get`, `calculate`, `is/has/can/should`, `find`, `create`, `with`, `to`, `format`, `parse`). 판별 접두사 뜻은 [이름](#이름)의 표를 따른다. `xxxOf`와 축약(`res`, `tmp`, `cb`, `opts`)은 쓰지 않는다. 넓은 범위의 `result`·`data`는 내용 이름으로 바꾼다.
- 순수성: 네트워크, 저장소, 로그, 현재 시각, 전역 `t`, 시간대 읽기를 하지 않고 인자로 받는다. 부수효과가 있으면 Service나 훅이다.
- `*.view-model.ts`와 이웃의 경계: 업무 규칙(허용, 한도, 상태 판정)이면 Policy, 화면 좌표·도형 계산이면 `*.geometry.ts`, 화면에 보일 값의 조합(i18n 키, 줄 나누기, 표시 목록, 그리기 값)이면 view-model, Policy를 감싸기만 하면 지운다. 지금 view-model 11개는 모두 화면 조합이다. 규칙은 이미 Policy에서 받는다(`subscription-failure`는 `SubscriptionFailurePolicy.getFailureCause`, `hourly-timeline`은 `WeatherReportPolicy.getUpcomingHours`, `plan-benefit`은 `EntitlementPolicy.getFreeLimit`). `weather-scene`은 날씨를 하늘·비·해·달의 그리기 값으로 바꾸고 좌표는 각 레이어가 정한다
- 인자: 위치 인자는 3개까지다. 4개 이상이면 이름 있는 객체다. 단 worklet과 프레임마다 도는 함수(`followLevel`)는 성능 때문에 위치 인자를 유지하고 이유를 주석으로 남긴다. 위치 불리언은 쓰지 않는다. 넓은 모델 대신 쓰는 칸만 `Pick`으로 받는다.

### 메모리 누수를 만들지 않는다

| 지점          | 규칙                                                                                                                   |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 리스너·구독   | `subscribe`·`add…Listener`는 해제 함수를 돌려주고 effect 정리에서 부른다. 외부 값은 `useSyncExternalStore`를 먼저 본다 |
| 타이머        | 정리에서 `clear`한다. es-toolkit `debounce`의 `flush`는 타이머를 남기므로 `cancel`까지 부른다(`useFormDraftAutosave`)  |
| 요청          | 서버 GET은 `signal`을 Service → HttpClient까지 넘겨 화면을 떠나면 멈춘다(`memoService.getMemo(memoId, signal)`)        |
| 음성 인식     | 언마운트 때 구독을 풀고 `abort()`한다                                                                                  |
| overlay       | `useOverlay`로 받아 소유 컴포넌트가 사라지면 함께 내려간다. 열 때 값이 굳으니 안에서 조회한다                          |
| 전역 Map·배열 | 지우는 시점 없이 쌓지 않는다                                                                                           |
| Query 키      | 안 쓰는 Query는 `gcTime`으로 정리한다. 영속 대상만 `persist`한다                                                       |

앱 전체의 메모리를 측정하거나 감사하지는 않았다. 위 규칙은 코드를 고칠 때 보는 기준이다.

### 타이머·구독 정리

effect는 개발 모드에서 마운트-정리-마운트를 한 번 더 돌려 정리가 빠진 곳을 드러낸다([React: effect가 두 번 도는 경우](https://react.dev/learn/synchronizing-with-effects#how-to-handle-the-effect-firing-twice-in-development)). 타이머·구독은 외부 시스템 연결이라 연결한 effect가 정리까지 맡는다([useEffect: 외부 시스템 연결](https://react.dev/reference/react/useEffect#connecting-to-an-external-system)).

- `setTimeout`·`setInterval`·`requestAnimationFrame`·`requestIdleCallback`은 effect 안에서 걸고 정리에서 `clear…`·`cancel…`한다. 핸들러에서 거는 타이머는 ref에 핸들을 두고 다시 걸 때와 언마운트 때 지운다(`useCopiedFeedback`).
- `AppState`·`Keyboard`·`BackHandler`·`Linking`·`AccessibilityInfo`의 `addEventListener`·`addListener`는 돌려받은 구독의 `.remove()`를, 포트의 `subscribe`는 돌려받은 해제 함수를 정리에서 부른다.
- await 뒤에 상태를 바꾸거나 이동하는 Promise 체인은 effect의 `AbortController`·`isCurrent` 플래그(`use-stable-feed-foreground.ts`), 또는 핸들러에서 시작한다면 언마운트 ref로 막는다. 언마운트 뒤에 `setState`·`router`를 부르지 않는다.
- effect 안에서 최신 콜백이 필요하면 deps에 넣어 타이머를 다시 걸지 말고 `useEffectEvent`로 읽는다.
- 모듈·서비스 수준 Map·Set은 크기 상한이나 지우는 시점을 둔다(`useTrackInviteLinkOpened`는 최근 20개만 기억한다). 앱 수명 동안 도는 구독은 첫 구독자가 생길 때 열고 마지막이 나가면 닫는다(`createMinuteClockStore`).
- 의도한 예외는 자기 종료를 함께 둔다. `VoiceRecordingIntake.listenForLate`는 언마운트 뒤 30초 동안만 듣고 스스로 풀며, 다시 걸면 앞의 구독을 먼저 푼다.

### 기다리지 않는 Promise

`void` 연산자를 쓰지 않는다(Oxlint). 이벤트 핸들러는 Promise를 돌려준다. 기다리지 않는 호출은 실패를 내부에서 처리하는 함수이거나 호출부에서 `.catch`로 기록한다. `.catch(noop)`은 실패가 이미 다른 곳에 보고될 때만 쓴다(mutation `onError`, 쿼리 오류 상태).

---

## 라우팅

- 리소스는 폴더 route다. 세그먼트는 kebab-case, 동적 세그먼트는 `[{entity}Id]`다(`/todo/[todoId]`). `[id]`는 쓰지 않는다.
- 같은 화면의 보기 상태(선택 항목, 필터, 날짜, 친구, 작성기)는 camelCase query param이다(`/feed?friendId=…&date=…`, `/memo?memoId=…`).
- 쓰는 query param은 nuqs처럼 쓴다. 값 하나면 `[value, setValue]`, 함께 쓰는 값이면 `[values, setValues]`다. 패키지는 넣지 않고 공용 `useRouteParams(schema)`(`shared/hooks/use-route-params.ts`) 위에 훅을 만든다. 읽기와 쓰기가 `schemas/{name}-params.schema.ts`의 스키마 하나를 지난다. 스키마 이름은 `{name}ParamsSchema`이고 훅 파일에 두지 않는다.
- 쓰는 필드의 URL 형식은 문자열이고 `z.codec`이다(`routeIdSchema`, `weatherRescheduleParamsSchema.todoIds`). `.transform`은 `z.encode`에서 터지고 `z.coerce`는 숫자로 남아 조용히 지워지므로 읽기 전용 필드(`routeIntegerStringSchema`, `openedAt`)에만 쓴다. 값 지우기는 `setParams({ date: undefined })`다. boolean은 `?isEditing=false`를 남기지 않도록 끌 때 `undefined`를 넘긴다. 없거나 잘못된 값은 `.catch`로 읽는다.
- 읽기만 해도 튜플이다. 값 하나면 `const [todoId] = useTodoId()`, 여럿이면 `const [{ inviteCode, source }] = useInviteParams()`이고 경로 세그먼트(`/todo/[todoId]`)도 같다. 한 파일만 읽으면 훅을 따로 만들지 않고 그 자리에서 `useRouteParams(schema)`를 부른다(`const [{ year, week }] = useRouteParams(achievementParamsSchema)`). 여러 파일이 읽을 때 `hooks/use-{name}-param(s).ts`로 뺀다. 이름은 값을 드러낸다(`useTodoId`, `useFeedDateKey`).
- 탭·보기처럼 값 하나만 바꾸면 공용 `useView(key, schema)`(`shared/hooks/use-view.ts`)다. `schema`는 `.catch` 기본값이 붙은 문자열 스키마 모듈 상수이고, `setView`는 스키마의 값만 받는다(`const [view, setView] = useView('view', invitedFriendsViewSchema)`). 한 파일만 쓰면 그 자리에서 부르고, 여러 파일이 같은 키를 읽으면 훅 하나로 뺀다(`useReportType`). heroui `Tabs`에는 `ViewTabs`(`src/shared/ui/view-tabs/view-tabs.md`)로 넘긴다. 여러 값을 함께 바꾸면 `useRouteParams`다(`useFriendListView`는 편집 모드를 함께 끈다).
- 값을 바꿀 때 함께 지울 값이 있으면 그 규칙은 세터 안에 둔다. 호출부가 잊을 수 없다(`useFeedFriendId`의 `selectFriend`, `useFeedSelectedTodoId`의 세터, `CLEARED_TODO_SELECTION`). 공개 세터로 안 되는 넘김(접힌 화면의 상세 넘김)도 훅이 맡는다(`useFeedTodoDetailHandoff`, `useMemoDetailHandoff`). `router.setParams`, `useLocalSearchParams` 구조 분해, 파라미터 훅 파일의 `z.object`는 `check:conventions`가 막는다.
- 라우트 id는 문자열을 숫자로 바꾼 뒤 검사한다(`routeIdSchema`). `as`로 건너뛰지 않는다.
- `app/`에는 route 파일만 둔다. `@react-navigation/*`를 직접 import하지 않는다. 플랫폼 분기는 `process.env.EXPO_OS`, Context 읽기는 `use`다.
- `useGlobalSearchParams`를 화면 훅에서 쓰지 않는다. 보이지 않는 화면도 URL이 바뀔 때마다 다시 렌더된다. 레이아웃은 내비게이터와 Provider만 두고 자식 params를 읽지 않는다.
- 이동은 호출부에서 `router.push({ pathname, params })`로 직접 쓴다. typed routes가 `pathname`과 동적 세그먼트를 컴파일 때 검사하므로 href 래퍼를 만들지 않는다. 경로 문자열을 잇지 않는다. 알림은 `utils/notification-destination.ts`, 위젯은 `WidgetNavigationPolicy.getRoute`가 목적지를 정한다.
- 시트 route는 `app/` route가 param을 `safeParse`해 틀리면 `Redirect`하고, 안쪽 컴포넌트는 같은 스키마의 튜플(`useRouteParams`, `useTodoId`)로 좁혀진 값을 읽는다. 스크린의 `safeParse`는 경계 분기라 튜플로 바꾸지 않는다.
- 피드는 `/feed` 한 화면이다. 내 피드와 친구 피드는 `friendId` param으로 바뀐다. 친구 전환은 `useFeedFriendId`의 세터(`router.setParams`)라 pane이 다시 마운트되지 않고 history가 쌓이지 않는다.
- 메모(`memo`)와 말로 메모(`voice-notes`) 스택은 `slide_from_bottom`이다. `voice-notes`는 녹음을 실수로 잃지 않게 스와이프로 닫지 않는다(`gestureEnabled: false`). 시스템 모달은 토스트·한도 안내가 뒤로 가려져 쓰지 않는다.
- 웹 페이지(약관·공지)는 route가 아니라 `useOpenInAppBrowser`(OS 앱 안 브라우저)로 연다. 앱 자체 WebView는 없다. `aido://webview/…` 링크는 `+not-found`로 간다.

---

## 상태

상태는 원천 하나에만 둔다. 같은 값을 두 저장소에 복사하지 않는다. 계산할 수 있는 값은 상태로 두지 않는다.

| 상태                                                  | 도구                                                                                                              | 판단 기준·예                                                                   |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 서버 데이터                                           | TanStack Query `queryOptions`·`mutationOptions`, `useSuspenseQuery`                                               | 서버가 진실이면 Query. 앱이 다시 계산하거나 복사하지 않는다                    |
| 기기 비동기 값(권한, 앱 아이콘)                       | TanStack Query                                                                                                    | 비동기·재조회가 필요하면 Query                                                 |
| URL에 남을 보기 상태(선택 항목, 탭, 날짜, 친구, 필터) | `{name}-params.schema.ts` + `useView`(탭·보기), `useRouteParams`(여러 값) 튜플(읽기와 같은 화면 안 변경)          | 딥링크·뒤로 가기로 복원돼야 하면 URL. `useState` 사본을 두지 않는다            |
| 기기에 남는 값(언어, 글꼴, 안내 본 여부)              | `apis/*.repository.ts`의 읽기·쓰기·`subscribe` + `useSyncExternalStore`(shared Provider는 `useSyncStorageString`) | 앱을 다시 켜도 남아야 하면 저장소. 키·파서는 repository 밖으로 내보내지 않는다 |
| 작성 중 초안                                          | `shared/draft`(암호화 MMKV, 사용자 범위)                                                                          | 긴 본문을 URL에 넣지 않는다. 초안을 Query 캐시에 넣지 않는다                   |
| 폼 값                                                 | react-hook-form + `zodResolver`                                                                                   | 폼 안에서만. 전역 상태에 복사하지 않는다                                       |
| 잠깐 쓰는 UI 값(열림, 측정값, 입력 단계)              | `useState`·`useReducer`                                                                                           | 나머지 전부                                                                    |

라이브러리가 주는 상태를 다시 만들지 않는다. 이 라이브러리 훅을 한 번 더 감싸는 훅도 만들지 않는다.

| 필요한 것           | 쓰는 것                                                                      | 만들지 않는 것                    |
| ------------------- | ---------------------------------------------------------------------------- | --------------------------------- |
| 저장 중, 저장 실패  | `mutation.isPending`, `error`, `isError`, `isSuccess`, `variables`           | `useState` 진행·오류 상태         |
| 조회 중, 조회 실패  | Suspense + 경계, `query.isLoading`, `isError`, `error`, `refetch`            | 직접 만든 로딩 상태               |
| 무한 목록           | `hasNextPage`, `isFetchingNextPage`, `isFetchNextPageError`, `fetchNextPage` | 페이지 번호 상태                  |
| 제출·유효성         | `formState.isSubmitting`, `isValid`, `isDirty`, `errors`                     | 폼 값 복사, 같은 규칙의 별도 함수 |
| 진행 중인 변경 여부 | `useIsMutating`, `useMutationState`                                          | 전역 플래그                       |
| 값 구독             | `useWatch`, `form.subscribe`                                                 | 렌더 경로 `getValues()`           |

- 한 컴포넌트에서 서로 독립인 `useSuspenseQuery`를 연달아 부르면 워터폴이다. `useSuspenseQueries`(`MemoEditor`)나 블록별 경계로 나눈다. 앞 결과가 다음 조회의 입력일 때만 순차로 둔다.
- 기기 저장 값의 repository는 `find*`·`get`·`has*`(읽기), 쓰기, `subscribe`를 한 파일에 둔다(`push-permission-prompt.repository`). 읽기는 저장값이 그대로면 같은 값을 돌려준다. 객체를 읽으면 저장 문자열로 스냅샷을 기억한다(`marketing-push-prompt.repository`, `activation-progress.repository`). 같은 값을 Query 캐시나 `useState`에 복사하지 않는다. 파일 크기처럼 구독할 수 없는 값만 화면에 들어올 때 읽는다(`settings/voice-storage`).
- 당겨서 새로고침은 `useRefresh`로 사용자가 당긴 동안만 표시한다(`MemoListScrollView`). `isRefetching`은 배경 재조회까지 켜져 동작이 달라진다.

예외:

- 초대 수락 결과: mutation 응답을 다음 화면(환영 시트)에 넘길 때 `queryFn: skipToken` 쿼리(`useGetRedemptionResultQueryOptions`)에 둔다. 보상·친구 결과를 URL로 넘기면 딥링크로 위조할 수 있다.
- 차단·신고 대상 이름: 사용자 한 명을 id로 조회하는 API가 없어 확인 문구의 이름을 route query(`name`)로 받는다. 표시용이고 판정은 폴더 param의 id로만 한다.
- 위젯 진입: `use-widget-app-entry.ts`는 앱 최상위에서 현재 화면과 무관하게 읽어야 해 `useGlobalSearchParams`를 쓴다.
- 입력 흐름: 회원가입·비밀번호의 `step`은 URL로 복원되면 안 돼 `useState`다. 친구 검색어는 입력 중인 값이고 복원 요구가 없어 지역 상태다.

### 폼

**폼 화면은 한 모양이다. 제출 로직은 컴포넌트, 제목과 간격은 스크린, 긴 흐름은 슬롯이다.**

| 자리                       | 맡는 것                                                                                                                                 |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 폼 컴포넌트                | `useForm`, mutation, 제출 뒤 이동, 입력칸, 키보드 위 버튼. `features/{feature}/components/{name}-form.tsx`                              |
| 스크린                     | 경계, 바탕과 바깥 여백(`ReadableContent`), 제목과 안내 글자, 위층이 필요한 값                                                           |
| 슬롯: `title`              | 제목 글자 하나. `FormStepLayout`에 넘긴다(`EditNameForm`, `InquiryForm`)                                                                |
| 슬롯: `children`, `footer` | 입력 위 제목·안내와 간격, 입력 아래 안내·링크(`EmailLoginForm`, `InviteCodeEntryForm`, `AddFriendForm`, `DeleteAccountForm`의 `footer`) |
| 슬롯: `stepTitles`         | 단계가 있는 긴 흐름의 단계별 제목(`ChangePasswordForm`, `ForgotPasswordForm`). 받은 값을 보여 주는 제목만 그 단계가 맡는다              |

```tsx
// app/(app)/(tabs)/(mypage)/friends/add.tsx
<Box className="flex-1 bg-white">
  <AddFriendForm onFriendLimitInvite={onFriendLimitInvite}>
    <H3>{t('add.title')}</H3>

    <Spacing size={4} />

    <Text size="b4" shade={6}>
      {t('add.description')}
    </Text>

    <Spacing size={24} />
  </AddFriendForm>
</Box>
```

예외는 둘이다. 네이티브 헤더 제목과 툴바가 단계를 따라 바뀌는 가입은 스크린이 `useStepper`를 갖고 폼에 넘긴다(`sign-up.tsx`). 화면 전체가 입력칸이고 제목이 없는 작성 화면은 폼 하나가 곧 화면이다(`MemoCreateForm`). 시트의 폼은 시트 컴포넌트가 소유하고 route는 파라미터 확인만 한다(`WeatherRescheduleSheet`).

폼 안은 메모 작성의 실제 코드와 같은 모양이다.

```tsx
// features/notes/memo/schemas/memo-form.schema.ts
export const memoFormSchema = createMemoSchema.pick({ content: true });
export type MemoFormValues = z.infer<typeof memoFormSchema>;

export const EMPTY_MEMO_FORM_VALUES: MemoFormValues = { content: '' };
```

```tsx
// features/notes/memo/components/memo-create-form.tsx
const { restoredDraft, saveDraft, clearDraft } = useDraftStorage(
  createMemoDraftKey({ userId: me.id }),
);
const form = useForm({
  resolver: zodResolver(memoFormSchema),
  defaultValues: restoredDraft ?? EMPTY_MEMO_FORM_VALUES,
  mode: 'onChange',
});
const { isSubmitting, isValid } = useFormState({ control: form.control });
```

```tsx
<Controller
  control={form.control}
  name="content"
  render={({ field: { value, onChange, ref } }) => (
    <TextArea
      ref={ref}
      variant="bare"
      preserveErrorSpace={false}
      placeholder={t('create.placeholder')}
      value={value}
      onChange={onChange}
    />
  )}
/>
```

- 이름은 `form`으로 통일한다. 입력 바인딩은 RHF `Controller` 공식 형태이고 `field.ref`를 이어 검증 실패 때 그 칸으로 포커스한다.
- 폼은 그 폼을 제출하는 컴포넌트가 소유한다. 읽기만 하는 자식은 `control`, `setValue`·`setFocus`까지 쓰는 자식은 `form`(`UseFormReturn<T>`)을 props로 넘긴다. `FormProvider`와 `useFormContext`는 쓰지 않는다(`useFormContext<T>()`의 제네릭은 검사 없는 단정이다). 입력과 출력의 타입이 다른 스키마를 Context로 나눠야 하면 값 필드를 `z.custom<T>()`로 입력과 출력을 맞춘다.
- 하위는 `useWatch({ name })`·`useFormState({ name })`로 자기 값만 구독한다.
- `useForm`은 제네릭 없이 `resolver`에서 타입을 추론한다(`@hookform/resolvers` 권장). 스키마가 변환 없이 입력과 출력이 같으면 타입은 `z.infer` 하나로 쓴다.
- 처음 값은 스키마의 `.default()`가 아니라 `defaultValues`에 둔다. 값이 없는 칸은 `undefined`가 아니라 `null`이다(RHF가 `undefined` 기본값을 권장하지 않고, 앱 모델의 "없음"도 `null`이다). 그래서 `?? null`·`?? undefined` 변환이 필요 없다.
- 폼 스키마는 `schemas/{name}-form.schema.ts`에 둔다. 서버 계약의 입력 스키마에서 `pick`·`extend`로 유도해 길이 한도와 규칙을 다시 적지 않는다.
- 저장 가능 여부는 스키마와 `formState.isValid`로 판단한다. 같은 규칙을 함수로 또 만들지 않는다.
- 렌더 경로에서 `getValues()`를 읽지 않는다. `reactCompiler: true`라 값이 캐시돼 갱신되지 않는다. jest는 컴파일러 없이 돌아 이 버그를 못 잡으므로 시뮬레이터에서 확인한다. `getValues()`는 이벤트 핸들러에서만 쓴다.

### 생성·수정

생성과 수정은 같은 스키마와 같은 입력 부품을 쓴다. 폼과 제출은 생성 컴포넌트와 수정 컴포넌트가 각자 소유하고, 공통 부품에 `mode`나 `onSubmit` 분기를 넘기지 않는다. 그 파일만 읽으면 무엇이 저장되는지 보여야 한다. 메모는 `MemoCreateForm`과 `MemoEditor`가 `memoFormSchema`와 `TextArea`만 공유한다. 할 일 변환은 `MemoConvertBottomSheet`가 폼과 제출을 갖고 할 일 작성기의 칩(`TodoComposerChips`)만 가져다 쓴다.

```tsx
// features/notes/memo/components/memo-create-form.tsx
// mutate 콜백은 화면이 내려가면 불리지 않는다. 저장이 끝났는데 초안이 남지 않게 기다린 뒤에 지운다
const saveMemo = (onFailed: (error: unknown) => void) =>
  form.handleSubmit(async ({ content }) => {
    try {
      await createMemo.mutateAsync({ content: content.trim() });
      discardDraft();
      goBack();
    } catch (error) {
      reportUnexpectedError(error);
      onFailed(error);
    }
  });
```

생성·수정 화면을 옮길 때 아래 표대로 동작하는지 테스트와 화면으로 확인한다. 지금 동작과 다른 칸이 있으면 임의로 맞추지 않고 그대로 둔 뒤 보고한다.

| 상황                  | 기대 동작                                                 |
| --------------------- | --------------------------------------------------------- |
| 저장 성공             | 닫힘, 목록·상세 갱신, 초안 삭제, 이벤트 1회               |
| 저장 실패(4xx)        | 입력값 유지, 오류 안내 1회                                |
| 연결 끊김             | 입력값·초안 유지, 무한 대기 없음(`networkMode: 'always'`) |
| 두 번 누름            | 요청 1회(`isSubmitting`, `isPending`)                     |
| 검증 실패             | 저장 버튼 비활성 또는 오류 표시, 요청 없음                |
| 수정인데 바뀐 값 없음 | 요청 없이 닫힘                                            |
| 반복 할 일 수정       | 범위 선택, 뒤로 가면 입력값 유지                          |
| 닫기·뒤로 가기        | 작성 중 값 처리(초안 또는 확인)가 지금과 같음             |

표와 다른 지금 동작: `MemoEditor`의 저장 버튼은 저장 뒤 닫지 않고 화면에 남아 편집을 끝낸다. 바뀐 글자가 없으면 요청 없이 끝낸다. 떠나는 것은 뒤로 가기(`handleBack`)다.

### 초안

- 초안은 `useDraftStorage(draftKey)`가 첫 렌더에 한 번 동기로 읽어 `defaultValues`에 넣는다. 빈 값으로 그린 뒤 채우지 않는다.
- `useFormDraftAutosave(form.subscribe, …)`가 렌더 없이 디바운스 저장한다. 언마운트(폴더블 전환) 때 대기 중인 저장을 flush하고, 제출 성공·취소는 반환된 함수로 대기 저장까지 취소한 뒤 지운다.
- 키는 `utils/{feature}-draft.ts`의 순수 함수(`createTodoCommentDraftKey`, `createMemoDraftKey`)가 `createDraftKey`로 만든다. 사용자 id가 항상 들어간다.
- 명시적 로그아웃·탈퇴 때만 `useAuthBoot`가 초안을 모두 지운다. 세션 만료는 초안을 남겨 같은 사용자가 이어 쓰게 한다. 로그인 후 `useClaimDeviceDataForUser`가 다른 소유자의 초안을 지운다. 7일 지난 초안(`DRAFT_TTL_MS`)은 앱 시작 때 정리한다.
- 초안 저장소는 MMKV `encryptionKey`(AES-256)로 암호화하고 키는 SecureStore에 둔다. 키 조회가 비동기라 `app/_layout.tsx`가 `useEncryptedStorageBootstrap`으로 스플래시 구간에 미리 열어 `DIProvider`에 넘긴다. 초안 화면이 동기로 복원하기 위해서다.
- 열기에 실패하면 초안 기능만 꺼지고(`disabledDraftStorage`) 앱은 동작하며 Sentry에 보고한다.
- 편집 초안은 서버 원본 수정 시각(epoch ms)을 함께 저장한다. 원본이 더 새로우면 초안을 버리고 toast로 알린다.
- 비밀번호·인증 코드는 초안으로 저장하지 않는다.
- 접기·펼치기에서 컴포넌트를 살릴 수 있으면 초안보다 재마운트를 없애는 쪽을 먼저 택한다(`AdaptivePane`).

---

## 상수와 날짜

같은 값이나 같은 계산을 두 곳에 두지 않는다. 숫자·키·문자열은 상수로 둔다. 매직 넘버를 쓰지 않는다.

| 종류                        | 둘 곳                                                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 서버·앱이 함께 쓰는 업무 값 | `@aido/api/vocabulary`. 앱에서 숫자·이름을 다시 적지 않는다                                                                   |
| 앱 전용 UI 값               | 피처 `constants/`, `shared/constants/`의 기존 파일. 애니메이션 시간은 `ANIMATION`                                             |
| 저장 키                     | 토큰은 `shared/constants/storage-keys.ts`, MMKV 기능 키는 그 repository의 기존 접두사(`aido_coachmark_v1:{accountId}:{kind}`) |
| 어댑터 옵션                 | 어댑터 파일 위 이름 붙은 상수                                                                                                 |

날짜 값·시간대·떠 있는 시각의 규칙은 [dates](../../../docs/conventions/dates.md)가 원본이다. 앱의 도구는 다음뿐이다. 새 `Intl` 포매터나 날짜 유틸을 만들지 않는다.

| 필요한 것      | 도구                                                                                                                                                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 오늘·자정      | `LocalDateProvider` + `useToday`·`useTodayKey`. render 중 `new Date()`를 기준으로 쓰지 않는다                                                                                                                          |
| 분 단위        | `useMinuteNow`                                                                                                                                                                                                         |
| 날짜 key       | `shared/date/date-key.ts`(`addDaysToDateKey`, `diffDateKeysInDays`, `getDayOfWeek`)                                                                                                                                    |
| 주             | `shared/date/date-key.ts`(`getCalendarWeek`)                                                                                                                                                                           |
| 순간 → 값      | `shared/date/instant.ts`(`toDateKey(d, tz)`, `toHHmm(d, tz)`). 시간대는 인자다                                                                                                                                         |
| 표시           | `shared/date/date-format.ts`, `date-labels.ts` + `useDateFormatContext`                                                                                                                                                |
| 시각           | `shared/date/time-of-day.ts`                                                                                                                                                                                           |
| 기기 시간대    | `shared/infra/localization/device-timezone.ts`(`getDeviceTimezone`)                                                                                                                                                    |
| 지금 시각 주입 | Service·저장소 생성자에 함수로 넘긴다. 순간을 다루면 `getNowInstant`, 저장 값이 epoch ms인 곳(초안 `DraftService`, 세션 해제 대기 `SessionRevocationService`)만 `Date.now`다. 저장 형식이 바뀌지 않게 둘을 섞지 않는다 |

---

## 모델과 Policy

**프론트엔드의 도메인 모델이다. 가장 중요한 규칙이다.** `saving-product.model.ts`처럼 모델 스키마·타입, 이름 있는 순수 함수, Policy Facade를 한 파일에 응집한다. 규칙과 모델을 가까이 두어 파일을 오가지 않고 한 곳에서 고친다. 문구, i18n 키, 색, 크기, 레이아웃, 화면 상태, 폼 값, 초안·저장 키는 넣지 않는다. 그런 값은 `*.view-model.ts`, `*-form.schema.ts`, `*-draft.ts`나 컴포넌트에 둔다.

**모델은 서버 응답에 의존하지 않는다.** 서버가 필드를 바꿔도 앱이 쉽게 대응하도록 모델은 앱이 쓰는 모양을 직접 정의하고, `apis/{entity}.mapper.ts`가 응답 DTO를 모델로 바꾼다. 서버가 바뀌면 mapper만 고치고 모델·Policy·화면은 그대로다. 그래서 모델 파일은 요청·응답 계약(`@aido/api` 루트·`contracts/*`)을 import하지 않는다. 용어 튜플·한도(`@aido/api/vocabulary`)와 오류 코드(`@aido/api/errors`)는 써도 된다.

```
features/{area}/{feature}/
├── domains/
│   ├── {entity}.model.ts        # 모델 스키마·타입 + 순수 함수 + {Entity}Policy
│   └── {feature}.error.ts       # 기능 오류
├── apis/
│   └── {entity}.mapper.ts       # 응답 DTO → 모델, 폼 값 → 요청
└── schemas/
    ├── {name}-form.schema.ts      # 폼 값
    ├── {name}-draft.schema.ts     # 저장하는 초안 값
    ├── {name}-params.schema.ts    # route 값
    ├── {name}-query-key.schema.ts # 쿼리 키 값
    ├── {name}-storage.schema.ts   # 기기 저장 모양(MMKV·SecureStore·위젯 저장소). 모델과 같으면 모델 스키마를 extend
    ├── {name}-request.schema.ts   # 서버로 보내는 요청 모양
    ├── {name}-response.schema.ts  # 서버와 공유하는 응답 모양(계약에서 pick·extend). 모델이 아니다
    ├── {name}-payload.schema.ts   # 다른 프로세스와 주고받는 메시지(푸시 data, 위젯 timeline props)
    └── {name}-entry.schema.ts     # 앱에 묶은 정적 목록 한 줄(whats-new 릴리스)
```

```typescript
// features/notes/memo/domains/memo.model.ts
export const memoSchema = z.object({
  id: z.int().positive(),
  content: z.string(),
  isPinned: z.boolean(),
  createdAt: instantSchema,
  updatedAt: instantSchema,
});
export type Memo = z.infer<typeof memoSchema>;

export const memoResourceLimitSchema = z.object({
  currentCount: z.int().nonnegative(),
  maxPerUser: z.int().positive(),
});
export type MemoResourceLimit = z.infer<typeof memoResourceLimitSchema>;

/** 지금 개수가 한도보다 적어야 새 메모를 만들 수 있다 */
export function canCreateMemo(limit: MemoResourceLimit) {
  return limit.currentCount < limit.maxPerUser;
}

/** 저장은 앞뒤 공백을 빼고 하므로 공백만 고친 글자는 바뀐 것이 아니다 */
export function hasContentChanged(memo: Pick<Memo, 'content'>, content: string) {
  return content.trim() !== memo.content;
}

export const MemoPolicy = {
  canCreateMemo,
  hasContentChanged,
} as const;
```

```typescript
// features/notes/memo/apis/memo.mapper.ts — 서버 필드가 바뀌면 여기만 고친다
export function toMemo(dto: MemoDto): Memo {
  return {
    ...pick(dto, ['id', 'content', 'isPinned']),
    createdAt: toInstant(dto.createdAt),
    updatedAt: toInstant(dto.updatedAt),
  };
}
```

**순수 함수는 이름과 인자로 뜻이 보인다.** `calculateExpectedAmount(monthlyAmount, term, annualRate)`처럼 무엇을 받는지 이름으로 드러나게 짓고, 외부 상태를 바꾸지 않는다. 규칙이 바뀌면 그 함수 하나만 고친다. 함수는 export해 테스트와 필터·정렬 인자(`filters={[(memo) => …]}`)에서 바로 쓰고, 화면은 보통 Policy로 묶어 소비한다.

**화면은 Policy로 소비한다.** `MemoPolicy.canCreateMemo(resourceLimit)`처럼 쓴다. 카드의 제목·본문 나누기(`toMemoPreview`)는 표시 값이라 `utils/memo.view-model.ts`에 둔다. 모델을 불필요하게 여러 개 만들지 않는다.

**이름은 동사로 시작한다.** `get*`(값 읽기·파생), `calculate*`(계산), `is*`·`has*`·`can*`·`should*`(판정, 접두사 뜻은 [이름](#이름)의 표), `find*`(검색), `create*`(생성), `with*`(불변 갱신). 부정 이름은 쓰지 않는다. `xxxOf`는 쓰지 않는다. Facade 키는 export한 함수 이름 그대로다. 별칭을 두지 않아야 검색 한 번에 정의와 사용처가 나온다.

**첫 인자는 모델이다.** 값이 하나만 필요해도 `Pick<Memo, 'content'>`로 받아 필드가 바뀌면 타입이 알려 주게 한다. 흩어진 필드 나열이나 DTO를 받지 않는다.

**Policy가 하지 않는 것.**

- 문구·아이콘·색·레이아웃·i18n 키를 돌려주지 않는다. 등급·단계 같은 의미 값을 돌려주고 컴포넌트가 `satisfies Record<Grade, …>` 맵이나 `match`로 그린다.
- 화살표 함수 본문을 Facade에 인라인으로 쓰지 않는다. 이름 있는 함수가 테스트 단위다.
- 현재 시각·오늘·시간대는 인자로 받는다. `Date.now()`·`new Date()`·`getDeviceTimezone()`을 호출하지 않는다.
- 다른 피처의 Policy를 재수출하거나 위임만 하는 함수를 두지 않는다.
- class로 만들지 않는다.

**순간과 달력 값.** 순간은 `Instant`(ISO 문자열 brand, `shared/date/instant.ts`)이고 달력 날짜·시각 값은 [dates](../../../docs/conventions/dates.md)를 따른다. 아직 `Date`를 쓰는 feature가 있어 영속 캐시는 `$date` 태그로 `Date`를 복원한다(`query-cache-persistence.ts`). 모두 옮기면 지운다.

**Zod는 최신 문법만 쓴다.** `z.int()`, `z.iso.date()`·`z.iso.time()`, `z.email()`·`z.url()`, `z.partialRecord`, `z.discriminatedUnion`, `z.enum(튜플)`, `.brand<'X'>()`. `z.nativeEnum`, `z.string().email()`, `.passthrough()`, `.strict()`는 쓰지 않는다.

### 서버 응답과 모델

함수와 화면은 서버 응답 모양에 의존하지 않고 앱 모델만 안다. 서버 필드가 바뀌면 mapper만 고친다. 요청·응답 계약은 `@aido/api`가 소유하고 앱 모델은 앱이 소유한다.

| `@aido/api` 진입점                        | 내용                                                        | import할 수 있는 곳                                                                                                                                                                   |
| ----------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@aido/api/vocabulary`                    | 용어 튜플·상수·한도(`MEMO_LIMITS` 등)                       | 어디서나(모델 스키마 `z.enum(DAYS_OF_WEEK)`, 폼 스키마)                                                                                                                               |
| `@aido/api/errors`                        | `ErrorCode`, 오류 상세 스키마(`quotaErrorDetailsSchema` 등) | 어디서나                                                                                                                                                                              |
| `@aido/api/common`                        | 응답 봉투, 날짜·시각 스키마, SemVer 비교                    | `shared`의 날짜·버전 도구, `shared/infra/http`                                                                                                                                        |
| `@aido/api`(루트)·`@aido/api/contracts/*` | 요청·응답 스키마와 DTO 타입                                 | `apis/`(mapper·service)와 `schemas/`(폼·공유 응답), HTTP 어댑터(`shared/infra/http/token-refresher`의 `contracts/auth`). 모델(`domains/`)은 쓰지 않는다. 테스트 fixture는 루트를 쓴다 |

- 모든 `domains/*.model.ts`는 계약을 import하지 않는다. 모델 스키마는 `domains/{entity}.model.ts`에만 두고 `schemas/` 파일은 위 접미사로 끝난다(둘 다 `check:conventions`가 막는다). 저장 모양이 모델과 같으면 모델 스키마를 `extend`해 버전·옛 값 처리만 더한다(`store-review-storage.schema.ts`).
- 공유할 값이 앱에만 있으면 `vocabulary`로 올린다. 숫자를 앱에서 다시 적지 않는다.
- 폼 스키마가 계약과 같은 값을 통과시키는지 mapper 테스트로 교차 검증한다(`memo.mapper.test.ts`).
- mapper는 계약 enum·유니온을 `satisfies Record<ContractEnum, …>`나 `exhaustive()`로 빠짐없이 매핑한다. 서버가 값을 더하면 빌드가 깨져 놓치지 않는다.
- brand·enum은 mapper가 `schema.parse`로 붙인다. `as`로 단정하지 않는다.
- 응답을 읽을 때 새 필드는 없을 수 있다(구 서버와 섞임). `== null`로 처리한다.
- 모델 테스트는 `*.model.test.ts`에서 `createX(overrides)`로 경계값까지 확인한다. mapper fixture는 계약 스키마로 검증해 만든다(`memoListResponseSchema.parse({ … })`). 계약과 어긋난 fixture로 통과하는 테스트를 막는다.

### 서버·클라이언트 계산 경계

| 서버가 계산하고 앱은 읽기만                                                                            | 앱이 계산                                           |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| 프리미엄 여부, 한도, 남은 횟수, `resetsAt`, 1회 길이 상한                                              | 메모 미리보기, 그룹핑, 정렬 표시                    |
| 차감·환불, 멱등 처리, AI 계획, 겹침 판정                                                               | 낙관적 갱신, 폼 검증(서버가 최종 판단)              |
| 반복 회차 생성, 순간 값 `scheduledTime`, 휴면                                                          | 달력 표시, `날짜 + 벽시계`의 현지 표시, 오늘        |
| 쿨다운, 초대·보상 상태                                                                                 | 선택 상태, 시트 열림, 레이아웃                      |
| 일간 완료(여러 날 할 일은 기간의 모든 날), 날씨와 겹친 할 일·옮길 시각 후보, 알림 목적지(`navigation`) | 변경 직후 그날 완료의 낙관적 갱신, 지난 후보 숨기기 |

앱은 왼쪽 값을 다시 계산하지 않는다. 응답에 필요한 값이 없으면 앱에서 만들지 않고 표시만 한다. 새 응답 필드는 서버 작업이라 따로 승인을 받는다. 앱 전체에서 다시 계산하는 곳을 전수로 찾지는 않았다.

---

## Service와 Mapper

Service는 포트를 주입받아 HTTP 호출 + Zod 검증 + Mapper 변환 + Policy 검증을 한다. `ApiError`는 번역하지 않고 그대로 넘긴다. class 하나이고 메서드는 arrow class field, private은 `#`다. 4xx는 `Result.err`, 5xx·네트워크·파싱은 throw다([errors](../../../docs/conventions/errors.md)).

```typescript
// features/notes/memo/apis/memo.service.ts
export class MemoService {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  getMemo = async (memoId: number, signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get(`v1/memos/${memoId}`, { signal }),
      memoDetailResponseSchema,
      ({ memo }) => toMemo(memo),
      '[MemoService] Invalid getMemo response',
    );
```

```typescript
// features/notes/memo/apis/memo.mapper.ts
export function toMemo(dto: MemoDto): Memo {
  return {
    ...pick(dto, ['id', 'content', 'isPinned']),
    createdAt: toInstant(dto.createdAt),
    updatedAt: toInstant(dto.updatedAt),
  };
}
```

- 생성자는 포트만 받고 기본값을 두지 않는다. 시각(`now`)처럼 바뀌는 값도 조립하는 곳이 넘긴다. 포트가 셋까지면 위치 인자, 넷부터 `{Class}Ports` 객체 하나다. 다른 Service는 쓰는 메서드만 `Pick<XService, 'method'>`로 받는다.
- `HttpClient`의 성공 값은 `unknown`이다. 응답 타입을 generic으로 단정하지 않고 공유 스키마로 전부 검증한다.
- 파싱 반복은 `parseApiResponse`(`shared/errors/parse-api-response.ts`)로 쓴다. 오류 문구 접두어를 그대로 받아 기존 문구, 테스트, Sentry 묶음을 유지한다. 파싱 실패 때 로그를 남기는 Service는 옮길 때 로그를 유지한다. 예외는 `SessionRevocationService` 하나다. `HttpClient`의 `Result`가 아니라 refresh 요청의 raw `Response`를 읽고, 응답이 계약과 다르면 던지지 않고 경고를 남긴 뒤 `null`로 기록을 지운다(로그아웃한 계정의 정리라 다시 시도할 일이 아니다). `parseApiResponse`는 4xx를 `Result`로, 계약 위반을 throw로 다뤄 이 흐름과 맞지 않는다.
- Mapper는 DTO·OS 값을 모델로 바꾸는 유일한 지점이고 순수 함수다.
- 컴포넌트는 `HttpClient`나 `Result`를 직접 다루지 않는다. `{feature}Service`와 `unwrap`을 거친다.
- 서버를 부르는 Service는 `queries/`(query·mutation 옵션)에서만 부른다. 기기 안에서 끝나는 Service(초안, 녹음 저장소, 코치마크, 대기 중인 초대, 앱 아이콘)는 캐시할 서버 상태가 없어 컴포넌트·훅의 이벤트 핸들러에서 `use{Name}Service()`로 바로 불러도 된다.

---

## Query와 Mutation

```
HTTP(unknown)
  → Service: @aido/api 스키마로 검증 → ParseError
  → Mapper: DTO → 클라이언트 모델   ← 서버 스펙 변경은 여기만 고친다
  → Query 캐시: 클라이언트 모델
  → select: 필터·정렬·표시 모델      ← 구독하는 화면별 파생
  → Component: Policy 호출 + 표시
```

### Query·Mutation 파일

조회는 `queries/{entity}.queries.ts`, 변경은 `queries/{entity}.mutations.ts`, 무효화는 `queries/{feature}-cache.ts`에 모은다. 작은 feature는 파일 하나, 큰 feature는 엔티티별이다. 파일 위치는 검사하지 않는다.

```typescript
// features/notes/memo/queries/memo.queries.ts
function selectMemos(data: InfiniteData<MemoPage>) {
  return data.pages.flatMap((page) => page.items);
}

export function useGetMemoQueryOptions({ memoId }: { memoId: number }) {
  const memoService = useMemoService();

  return queryOptions({
    queryKey: MEMO_QUERY_KEYS.detail({ memoId }),
    queryFn: async ({ signal }) => unwrap(await memoService.getMemo(memoId, signal)),
  });
}
```

```typescript
// features/notes/memo/constants/memo-query-keys.ts
export const MEMO_QUERY_KEYS = {
  all: ['memo'] as const,
  list: () => [...MEMO_QUERY_KEYS.all, 'list'] as const,
  details: () => [...MEMO_QUERY_KEYS.all, 'detail'] as const,
  detail: ({ memoId }: { memoId: number }) =>
    queryOptions<Memo>({ queryKey: [...MEMO_QUERY_KEYS.details(), { memoId }] }).queryKey,
  resourceLimit: () => [...MEMO_QUERY_KEYS.all, 'resource-limit'] as const,
} as const;
```

```typescript
// features/notes/memo/queries/memo.mutations.ts
export function useCreateMemoMutationOptions() {
  const memoService = useMemoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const haptics = useHaptics();
  const toast = useAppToast();

  return mutationOptions({
    // 오프라인에도 멈춰 기다리지 않고 바로 실패해 글자를 남긴 채 안내한다. 글자는 초안에도 있다
    networkMode: 'always',
    mutationFn: async (values: MemoFormValues) => unwrap(await memoService.createMemo(values)),
    onSuccess: () => trackEvent('memo_created'),
    onError: (error) => {
      haptics.notify('error');
      toast.error(getUserFacingMessage(error), { fallback: t('memo:toasts.retryLater') });
    },
    // 기다리면 mutateAsync가 재조회까지 묶여 저장 후 뒤로 가기가 늦어진다. 다른 메모 상세는 그대로다
    onSettled: () => {
      invalidateMemoList(queryClient);
      invalidateMemoResourceLimit(queryClient);
    },
  });
}
```

### 쿼리 규칙

- **훅:** 서비스가 DI에 있으므로 옵션은 `useGetXQueryOptions` 훅이다. 컴포넌트는 `useSuspenseQuery(useGetXQueryOptions(…))`처럼 사용처에서 바로 부른다. 옵션을 감싸는 훅을 더 만들지 않는다. `getXQueryOptions` 함수는 훅 밖(`queryClient.fetchQuery`, 프리페치)에서 쓸 때만 `({ xService }, params)` 인자로 export한다. 옮긴 feature에는 아직 그런 예가 없다.
- **인라인 금지:** query key·queryFn·캐시 정책을 컴포넌트에 인라인으로 만들지 않는다. 키를 하드코딩하지 않는다.
- **키:** `{FEATURE}_QUERY_KEYS`이고 인자는 이름 있는 객체 하나다. 캐시를 직접 읽고 쓰는 단건 키는 `queryOptions<T>({ queryKey }).queryKey`로 데이터 타입을 붙여 `getQueryData`·`setQueryData`가 제네릭 없이 타입을 안다(TanStack TypeScript 문서의 DataTag). 접두사로 여럿을 고르는 `getQueriesData`·`setQueriesData`만 제네릭을 쓴다. 범위는 복수(`lists`, `details`), 단건은 단수(`detail`)다. 인자 없는 목록은 `list()` 하나면 된다. 키 이름에 피처 접두사를 반복하지 않는다. 영속 대상 키 값을 바꾸면 `QUERY_CACHE_SCHEMA_VERSION`을 올린다. 이 이유를 키 파일마다 주석으로 다시 적지 않는다.
- **signal:** 서버 GET은 `signal`을 넘긴다.
- **select:** 함수 참조가 바뀌면 다시 실행되므로 모듈 수준 `function`(`selectMemos`)이나 `useCallback`으로 둔다. 필요한 값만 구독할 때 쓴다. 오류를 던지는 데 쓰지 않고 서버 스키마를 변환하지 않는다(캐시에 DTO가 남으면 낙관적 업데이트가 서버 모양을 알아야 한다).
- **필터:** 클라이언트 필터는 key에 넣지 않고 select로 같은 캐시를 공유한다. 서버 파라미터는 key에 넣는다.
- **구조 공유:** `Date`는 plain 객체가 아니어서 같은 값이어도 새 참조가 되고 그 객체와 조상까지 참조가 바뀐다. 그래서 `Date`가 있는 모델은 재조회 때 다시 그려질 수 있다. 순간은 `Instant` 문자열로 둔다(메모 18개 재조회에서 유지되는 참조 0개 → 18개, `memo.mapper.structural-sharing.test.ts`).
- **추적 속성:** 결과를 rest로 구조 분해하지 않는다.
- **`mutationFn`:** 반드시 `unwrap()`한다. `Result.err()`를 돌려주면 React Query가 성공으로 보고 `onSuccess`를 부른다. 오류 분기는 [에러 처리](../docs/error-handling.md)를 본다.
- **`onSettled`·`onSuccess`의 기다림:** 콜백이 Promise를 돌려주면 `mutateAsync`가 무효화 재조회까지 기다린다. 저장 후 떠나는 변경(create·delete·convert·update·pin)은 기다리지 않는다. update는 뒤로 가기 저장이 떠나므로 `onSuccess`에서 목록의 그 항목만 바꾸고(`replaceMemoInList`), pin은 `onSettled`에서 `invalidateMemoList`를 부르되 돌려주지 않는다(`useSetMemoPinnedMutationOptions`). 화면에 머무는 목록의 행 버튼(친구 수락·거절)은 `onSuccess`에서 무효화를 기다려 행이 사라질 때까지 버튼을 꺼 둔다. 다시 눌러 요청이 또 가지 않게 하기 위해서다. 지운 메모의 재조회가 먼저 끝나면 404가 경계로 내려간다.
- **무효화:** 다른 feature의 캐시는 그 feature의 `{feature}-cache.ts` 함수로만 무효화한다(`invalidateMemos`). 자기 feature 안에서 범위를 좁힐 때만 자기 키를 직접 쓴다. 키 위치에 기대는 구조 분해(`const [, , params] = query.queryKey`)를 쓰지 않는다.
- **무효화 범위:** 바뀐 것만 무효화한다. 응답이 바뀐 값을 다 담으면 `setQueryData`로 고치고 다시 받지 않는다(TanStack "Updates from Mutation Responses"). 작은 변경 뒤 `X.all`이나 필터 없는 `invalidateQueries()`를 부르지 않는다. 바뀐 범위를 모를 때(반복 묶음, 카테고리 삭제, 당겨서 새로 고침, 언어 변경)만 넓게 쓴다.

### 낙관적 갱신

여러 화면이 같은 값을 보여 주면 캐시로(TanStack "Optimistic Updates"의 via the cache), 그 버튼 하나만 보여 주면 `useMutation`의 `variables`로 그린다. 되돌릴 수 없는 삭제(카테고리 삭제)는 미리 빼지 않고 버튼만 불러오는 중으로 둔다. 캐시로 할 때는 순서가 하나다.

1. `onMutate`: 덮어쓸 수 있는 키만 `cancelQueries`(단건은 `exact: true`) → `getQueryData`로 스냅샷 → `setQueryData(key, (old) => old && withX(old, …))` → 스냅샷을 돌려준다. updater는 `*-cache.ts`의 순수 함수다(`withCategoryAdded`). 업무 규칙이면 `domains/*.model.ts` Policy다.
2. `onError`: 돌려받은 스냅샷으로 되돌린다. 같은 키를 동시에 쓰는 뮤테이션이 있으면 통째로 덮지 않고 그 변경만 되돌린다.
3. `onSettled`: 바뀐 키만 무효화한다. 동시에 쓰는 뮤테이션은 `mutationKey`를 두고 `isMutating({ mutationKey }) === 1`일 때만 다시 받는다.

```typescript
// features/planning/category/queries/todo-category.mutations.ts
onMutate: async ({ id, input }) => {
  await queryClient.cancelQueries({ queryKey: TODO_CATEGORY_QUERY_KEYS.list(), exact: true });
  const previousData = queryClient.getQueryData(TODO_CATEGORY_QUERY_KEYS.list());
  queryClient.setQueryData(
    TODO_CATEGORY_QUERY_KEYS.list(),
    (old) => old && withCategoryChanged(old, id, input),
  );
  return { previousData };
},
onError: (_error, _variables, context) => {
  if (context?.previousData != null) {
    queryClient.setQueryData(TODO_CATEGORY_QUERY_KEYS.list(), context.previousData);
  }
},
onSettled: () => invalidateTodoCategories(queryClient),
```

### 할 일 목록의 낙관적 갱신

`features/planning/todo/queries/todo-cache.ts` 한 곳의 규칙을 따른다.

- 날짜는 할 일의 `startDate`가 아니라 보고 있는 목록의 `date`다. 여러 날 할 일은 여러 날짜 목록에 있다.
- `onMutate`: `beginTodoWrite`로 그 목록·상세(달력까지 바꾸면 그날을 담은 완료 범위)만 멈추고, 돌려받은 표를 context에 담는다. `updateCachedTodo`로 목록·상세를 함께 고치고 달력은 `syncDailyCompletionWithList`로 목록에서 다시 계산한다.
- `onError`: 스냅샷을 통째로 덮지 않고 그 변경만 되돌린다. 통째로 덮으면 함께 진행 중인 다른 변경을 지운다.
- `onSuccess`: 응답이 확정한 값(만든 할 일, 존재 여부, 카테고리 개수)은 `setQueryData`로 고친다.
- `onSettled`: `mutationKey`에 `TODO_MUTATION_KEYS`를 두고 `settleTodoWrite`만 부른다. 확정된 목록·하루짜리 달력은 다시 받지 않고, 기간 안의 다른 날짜 목록·겹치는 달력 범위·위젯 요약만 낡음(`refetchType: 'none'`)으로 표시한다. 실패했거나 다른 쓰기와 겹쳤으면 고친 목록·상세·달력까지 맞춘다. 마지막 쓰기만 화면에 붙은 낡은 조회를 다시 받아 낙관적 값이 되돌아가지 않는다.
- 되돌릴 값과 기간은 `findCachedTodo`로 그날 목록 → 상세 → 다른 날짜 목록 순으로 읽는다. 알림으로 연 상세는 그날 목록이 없다.
- 저장을 기다리는 시트(제목·날짜·시각·카테고리 고치기)는 낙관적으로 쓰지 않는다. 같은 `listWrites` 키로 세고 `onSuccess`에서 `settleTodoEdit`로 고치기 전·후 값의 날짜 목록·위젯 요약, 날짜·색이 바뀌면 달력, 카테고리가 바뀌면 개수만 맞춘다. 반복 범위·규칙을 바꾸면 바뀐 회차를 몰라 `invalidateTodos`다.
- 하위 항목 진행(막대·"2/4")은 저장하지 않고 `SubTodoPolicy.getSubTodoStats`로 항목 목록에서 센다. 항목 추가는 끝낸 할 일일 때만 완료가 풀려 달력·위젯·존재 여부를 맞춘다.
- 임시 id는 음수다(`createOptimisticId`). 임시 행은 `TodoPolicy.isOptimisticTodo`·`SubTodoPolicy.isOptimisticSubTodo`로 막고, 응답이 오면 다시 받기 전에 서버 id로 바꾼다.

---

## 오류와 관측

- 오류 분류와 처리는 [에러 처리](../docs/error-handling.md)가 원본이다. 요약: 예측 가능(4xx, Policy)은 `Result.err()` → mutation `onError`, 예측 불가(5xx, 네트워크, 파싱)는 `throw` → 조회는 `QueryErrorBoundary`, mutation은 기본 토스트다. 한 오류는 토스트와 fallback 중 한 곳에서만 보인다.
- 로깅은 Sentry(`Logger`·`ErrorReporter`, 이벤트 키)와 GA(`useTrack`, `AppEventMap`) 양쪽을 일관되게 남긴다. 실패를 조용히 삼키지 않는다. 상세: [observability](./observability.md).

---

## Port·Adapter·DI

```
core/ports (인터페이스) ← shared/infra (어댑터) ← di-provider (조립) → di-context (use{X} 훅) → 컴포넌트·쿼리
                                                      └→ shared-di-context (shared가 쓰는 포트만 나눈 훅)
```

`shared`는 `bootstrap`을 import하지 못하므로 `shared`가 쓰는 포트(`logger`, `analytics`, `errorReporter`, `haptics`, `externalLink`, `systemShare`, `syncStorage` 등)는 `shared/di/shared-di-context`의 훅으로 읽는다. feature와 `app/`은 입구 하나인 `di-context`에서만 꺼낸다. `di-context`가 필요한 `shared-di-context` 훅을 다시 내보낸다.

왜 이렇게 하나:

1. **라이브러리를 쉽게 바꾼다.** 앱 코드는 포트만 안다. 라이브러리를 바꾸면 어댑터 파일과 `di-provider`만 바뀐다. 어댑터 밖이 바뀌면 포트 설계가 틀린 것이다.
2. **실제와 가깝게 테스트한다.** `jest.mock`으로 모듈을 가로채지 않고 포트 stub만 끼운다. 서비스·모델·화면은 실제 코드가 돈다. [testing-guide](./testing-guide.md#stub-우선-di-테스트).
3. **기기에 없는 상황을 만든다.** 마이크 없는 시뮬레이터, 전화로 끊긴 인식, 결제 실패를 구현체 교체로 재현한다.

stub 테스트가 통과해도 실제 SDK·OS 동작은 보장하지 않는다(Hermes에 없는 메서드, 기기별 인식기 차이). 그 부분은 실기기 QA로 확인한다.

### 규칙

- **SDK는 `shared/infra`에서만 import한다.** 한 줄짜리 호출이어도 어댑터를 거치고, 쓰는 쪽은 `use{X}` 훅으로 받는다. 다른 개발자가 헷갈리지 않게 일관성을 우선한다.
- **예외는 두 가지뿐이다.**
  - 라이브러리 자체가 React 훅이면 `shared/infra` 안의 경계 훅 파일 하나에서만 import한다(`expo-audio`는 `shared/infra/audio/use-audio-part-playlist.ts`, `expo-keep-awake`는 `shared/infra/keep-awake/use-keep-screen-awake.ts`, `expo-localization`은 `shared/infra/localization/device-locale.ts`, `useLinkingURL`은 `shared/infra/linking/use-linking-url.ts`). 라이브러리 자체가 컴포넌트면 경계 컴포넌트 파일 하나에서만 import한다(`react-native-view-shot`은 `shared/infra/view-capture/capturable-view.tsx`).
  - React 밖 코드(시작 시 값, 위젯 진입점, 부트스트랩)는 DI 훅을 부를 수 없으니 `shared/infra`의 함수를 직접 import한다.
- **SDK 직접 import 예외(검사 대상이 아닌 라이브러리).** `expo-router`는 라우터 교체가 route 전체를 바꾸는 일이라 포트로 숨기지 않고, 화면과 route 경계 훅(`useRouteParams`, `useView`, `useSingleTap` 등)에서 import한다. `env.ts`는 `expo-constants`로 앱 설정을 읽고, 루트 레이아웃은 `expo-splash-screen`을, 내비게이션 테마는 `@react-navigation/native`를 직접 쓴다. 이유는 `check-mobile-conventions.mjs`의 `SDK_MODULES` 위 주석에 있다.
- **`check:conventions`가 강제한다.** 예외 목록은 없다. 검사 대상이 아닌 라이브러리(`expo-router`, UI 라이브러리, 위젯 자기 조립, `expo-constants`, `expo-splash-screen`)와 이유는 `SDK_MODULES` 위 주석에 있다.
- **파일 이름은 내보내는 이름을 말한다.** 포트 파일은 주 인터페이스 이름의 kebab-case다(`ClipboardGateway` → `clipboard-gateway.ts`, `HttpClient` → `http-client.ts`). 어댑터 파일은 `{공급자}-{포트 파일 이름}.ts` 한 형식이고 내보내는 이름이 그대로 camelCase다(`expo-clipboard-gateway.ts` → `expoClipboardGateway`, `revenuecat-purchases-gateway.ts`, `kakao-social-share-gateway.ts`, `expo-system-share-gateway.ts`). 한 파일이 포트 둘을 구현하지 않고 포트마다 파일을 나눈다(`expo-external-link-gateway.ts`, `expo-incoming-link-gateway.ts`). 테스트는 어댑터 옆 `-gateway.test.ts`다.
- **포트 이름은 앱의 말로 짓는다.** SDK·공급자 이름을 쓰지 않는다(`setFirebaseAppInstanceId` → `setAnalyticsId`, `setString` → `copy`). 구독은 `subscribe*`(`subscribeToken`, `subscribeResponse`), 읽기는 `get*`이다. 같은 종류의 포트는 같은 동사를 쓴다.
- **플랫폼·기기 차이는 어댑터 안에 숨긴다.** Android 알림 채널 준비, OS 버전 비교(`device-info`의 `ANDROID_API_LEVEL`, `IOS_MAJOR_VERSION`)가 그렇다. Service·Policy·domains·utils에는 `EXPO_OS`, `Platform`, SDK 타입을 올리지 않는다. 컴포넌트와 스크린의 UI 모양 분기만 `process.env.EXPO_OS`로 쓴다.
- **어댑터가 쓰는 관측은 주입받는다.** 어댑터와 HTTP 훅은 전역 접근자 대신 팩토리·deps로 `logger`, `errorReporter`를 받는다(`createExpoPushNotificationGateway(logger)`, `createAuthClient({ logger, errorReporter })`). 전역 `logger`는 아래 표의 곳만 쓴다.
- **공급자 설정은 어댑터가 읽는다.** 결제 키는 `revenuecat-api-key.ts`가 `extra`에서 읽고 `env.ts`는 모른다. 포트의 초기화는 인자 없이 결과만 돌려준다(`PurchasesGateway.configure()`).
- **포트에는 앱이 필요한 기능만 둔다.** SDK 타입을 밖으로 내보내지 않고 plain 값으로 넘긴다.
- **조립은 `di-provider.tsx` 한 곳이다.** 서비스·저장소를 다른 곳에서 `new` 하지 않는다.
- **Mapper는 DI에 넣지 않는다.** 순수 함수라 서비스가 직접 import한다.

### 직접 import·`new`·전역을 허용하는 곳

feature·`app/`·`bootstrap`이 `shared/infra`를 직접 import하거나 `new`로 만드는 곳은 아래뿐이다. 새로 늘리지 않고, 포트로 옮길 수 있으면 옮긴다.

| 곳                                                                                                                                                                                                                                                                                  | 이유                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 훅 경계: `useAudioPartPlaylist`(`use-voice-note-player`), `useKeepScreenAwake`(`voice-notes/record`), `useSystemLocale`(`weather-hero`, `use-temperature-unit`), `useLinkingUrl`(`use-widget-app-entry`), `CapturableView`(`achievement-summary`, `weekly-achievement-certificate`) | 라이브러리 자체가 React 훅이라 DI 값으로 바꿀 수 없다. 훅 파일 하나가 SDK를 가린다                                                                                               |
| `app/_layout.tsx`: `initErrorReporting`, `createEnvironmentErrorReporter`, 전역 `logger`, `reloadApp`                                                                                                                                                                               | 루트 경계는 Provider 밖에서 그려진다. DI 훅을 부를 수 없다                                                                                                                       |
| 위젯 진입점: `register-widget-task-handler.android.ts`, `android-widgets.bridge.ts`(`widgetStorage`, `getDeviceLanguage`)                                                                                                                                                           | 위젯만 깨어난 프로세스에는 앱 트리가 없다. 실패는 `widget-headless-failure.repository`에 남기고 다음 앱 시작 때 `WidgetSyncService.reportHeadlessFailure`가 오류 보고기로 보낸다 |
| `notification-provider`(`registerForegroundNotificationPresentation`)                                                                                                                                                                                                               | 앱 시작 때 한 번 거는 모듈 수준 설정이다                                                                                                                                         |
| `device-info`(`DEVICE_TOTAL_MEMORY_BYTES`, `IS_PHYSICAL_DEVICE`, `IOS_MAJOR_VERSION`)                                                                                                                                                                                               | 시작 때 정해지는 상수라 렌더 중 호출이 아니다. 날씨 장면 품질, 날씨 화면의 iOS 스크롤 엣지 효과 판단, 개발 API 주소만 쓴다                                                       |
| `device-info`(`ANDROID_API_LEVEL`) — `todo-comment-keyboard-scroll-view`                                                                                                                                                                                                            | 키보드 UX다. Android 15 미만에서만 키보드 높이를 직접 보정하므로 렌더 중 읽는 시작 상수로 충분하다                                                                               |
| `new SecureStorage`(`di-provider`, `use-encrypted-storage-bootstrap`)                                                                                                                                                                                                               | 암호화 초안 저장소는 키체인에서 키를 읽어 열린 뒤에야 DI가 만들어진다. 부트스트랩이 같은 어댑터를 따로 연다                                                                      |
| `new VoiceRecordingIntake`(`use-voice-note-recording`)                                                                                                                                                                                                                              | 초안마다 하나씩 만들어 화면이 내려간 뒤에도 파일을 받는 수명 객체다. 상태를 갖지 않는 Service가 아니라 DI에 두지 않는다                                                          |
| 모듈 수준 전역 `logger`: `env.ts`, `use-is-reduce-motion-enabled`, `use-is-reduce-transparency-enabled`, `query-cache-persistence`, `openSupportMail`, `query-error-actions`                                                                                                        | DI보다 먼저 만들어지거나(`env`, 조회 캐시 복원) 모듈 단일 저장소(접근성 설정)이거나 Provider 밖(루트 경계 문의)이라 주입할 곳이 없다                                             |
| `query-provider`(`getAppBundleId`, `deviceSyncStorage`), `font-scale-provider`·`theme-provider`·`language-provider`(`deviceSyncStorage`, `useSystemLocale`)                                                                                                                         | `app-providers`에서 DI보다 위에 있어 훅으로 읽을 수 없다                                                                                                                         |
| `local-date-provider`·`local-date-clock`(기기 시계), `i18n/init`(기기 언어·저장 언어), `use-window-size-class`(창 크기 경계 훅), `app/_layout.tsx`의 `wrapRootComponent`                                                                                                            | 시작 값이거나 위젯과 공용인 시계, 라이브러리 경계 훅이라 옮길 곳이 없다                                                                                                          |
| `query-error-actions`(메타데이터·링크 어댑터)                                                                                                                                                                                                                                       | 루트 `QueryErrorBoundary`가 Provider 밖에서 그려진다                                                                                                                             |

기기 동기 값을 렌더에서 읽는 Service는 컴포넌트가 `useXService()`로 직접 부른다(저장소 읽기라 Suspense·쿼리가 필요 없다). 서버 비동기는 쿼리 옵션 훅으로만 부른다.

### 대표 포트

전체 목록은 `core/ports/`에 있다.

| 포트                      | 메서드 이름                                                                                                                                             | 어댑터 (`shared/infra/`)                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `HttpClient`              | `get`·`post`·`put`·`patch`·`delete`                                                                                                                     | `http/ky-client.ts`                                   |
| `Storage`                 | `get`·`set`·`remove`                                                                                                                                    | `storage/secure-storage.ts`                           |
| `SyncStorage`             | `get`·`set`·`remove`                                                                                                                                    | `storage/encrypted-draft-storage.ts`                  |
| `ObservableSyncStorage`   | `SyncStorage` + `subscribe`(키별 변경 알림)                                                                                                             | `storage/device-sync-storage.ts`                      |
| `EnumerableSyncStorage`   | `SyncStorage` + `keys`·`clear`                                                                                                                          | `storage/encrypted-draft-storage.ts`                  |
| `ClipboardGateway`        | `copy`. 붙여 넣기는 입력 칸의 네이티브 메뉴에 맡긴다                                                                                                    | `clipboard/expo-clipboard-gateway.ts`                 |
| `ExternalLinkGateway`     | `open`·`openInAppBrowser`·`openSettings`                                                                                                                | `linking/expo-external-link-gateway.ts`               |
| `IncomingLinkGateway`     | `getInitialUrl`·`subscribe`                                                                                                                             | `linking/expo-incoming-link-gateway.ts`               |
| `SystemShareGateway`      | `share`·`isImageShareAvailable`·`shareImage`                                                                                                            | `share/expo-system-share-gateway.ts`                  |
| `LocationGateway`         | `getPermission`(`isGranted`, `canAskAgain`)·`requestPermission`·`recheckPermission`·`getCoordinates`·`getPlace`                                         | `location/expo-location-gateway.ts`                   |
| `PurchasesGateway`        | `configure`·`purchase`·`restore`·`getOffering`·`getStatus`·`subscribe`                                                                                  | `purchases/revenuecat-purchases-gateway.ts`           |
| `SpeechRecognizer`        | `start`·`stop`·`abort`·`subscribe` 등                                                                                                                   | `speech/expo-speech-recognizer.ts`                    |
| `PushNotificationGateway` | `getPermission`·`requestPermission`·`getToken`·`subscribe*` 등                                                                                          | `notification/expo-push-notification-gateway.ts`      |
| `HapticsGateway`          | `selection`·`impact`·`notify`                                                                                                                           | `haptics/expo-haptics-gateway.ts`                     |
| `NetworkStatusGateway`    | `subscribe`                                                                                                                                             | `network/expo-network-status-gateway.ts`              |
| `ViewCaptureGateway`      | `capture`(찍을 영역은 `shared/infra/view-capture/capturable-view.tsx`의 `CapturableView`가 만든다)                                                      | `view-capture/view-shot-view-capture-gateway.ts`      |
| `AppLifecycleGateway`     | `getCurrentState`·`subscribe`. 화면은 `useSyncExternalStore(subscribe, getCurrentState)`로 읽고, 앞으로 돌아올 때만 하는 일은 쓰는 hook 안에서 구독한다 | `app-lifecycle/react-native-app-lifecycle-gateway.ts` |
| `IdGenerator`             | `create`                                                                                                                                                | `id-generator/expo-id-generator.ts`                   |
| `Logger`                  | `debug`·`info`·`warn`·`error`                                                                                                                           | `logger/`                                             |
| `Analytics`               | `trackEvent`·`trackScreenView` 등                                                                                                                       | `analytics/`                                          |
| `ErrorReporter`           | `captureException`·`captureMessage`·`addBreadcrumb`                                                                                                     | `error-reporter/`                                     |

`core/`는 `shared`와 feature를 import하지 않는다. 포트가 쓰는 관측 키와 오류 타입은 `core/observability/telemetry-keys`, `core/errors`에 있다.

### 케이스별 사용법

| 필요한 것                | 방식                               | 꺼내는 훅 예시                       |
| ------------------------ | ---------------------------------- | ------------------------------------ |
| 일회성 네이티브 기능     | 포트 + 어댑터                      | `useClipboard()`, `useHaptics()`     |
| 서버 데이터              | `HttpClient` → 서비스 → 쿼리 옵션  | `useGetMemoQueryOptions()`           |
| 로컬 저장값              | `SyncStorage` → 저장소 → 서비스    | `useCoachmarkService()`              |
| 값 하나 읽고 쓰는 저장소 | `SyncStorage` → 저장소             | `useRecognitionLanguageRepository()` |
| 이벤트 스트림            | 포트의 `subscribe`, 해제 함수 반환 | `useSpeechRecognizer()`              |
| 관측                     | 포트. feature는 분석에 `useTrack`  | `useLogger()`, `useTrack()`          |

### 예: 클립보드

```typescript
// core/ports/clipboard-gateway.ts
export interface ClipboardGateway {
  copy(text: string): Promise<void>;
}

// shared/infra/clipboard/expo-clipboard-gateway.ts
import * as Clipboard from 'expo-clipboard';

export const expoClipboardGateway: ClipboardGateway = {
  copy: async (text) => {
    await Clipboard.setStringAsync(text);
  },
};

// bootstrap/providers/di-provider.tsx
clipboard: expoClipboardGateway,

// bootstrap/providers/di-context.tsx
export function useClipboard() {
  return useDI().clipboard;
}

// 컴포넌트
const clipboard = useClipboard();
await clipboard.copy(comment.content ?? '');
```

### 포트별 참고

- **음성 인식**: 화면은 `SpeechRecognizer`의 `mode`(`dictation`·`quick`·`note`)를 고르고, 기기 안 인식(`isOnDevice`)과 인식 힌트는 `getRecognizerStartOptions`가 정한다(개인 단어는 기기 안 인식에만 주는 것이 앱 규칙이다). 연속 인식·문장부호·음량 정규화·녹음 파일 옵션과 힌트 개수 상한은 어댑터가 정한다. 인식 이벤트는 앱 전체에 하나라 `subscribe`한 쪽이 자기가 시작한 세션의 이벤트만 쓴다.
- **결제**: `PurchasesGateway`는 RevenueCat 타입 대신 plain 값과 `PurchasesGatewayError(kind, storeErrorCode)`만 넘긴다. `subscription.mapper.ts`가 모델로 바꾼다.
- **푸시**: 서비스는 게이트웨이가 준 OS 원본(`PushPermissionResponse`)을 `push-permission.mapper.ts`로 모델에 바꾼 뒤에만 Policy에 넘긴다. 흐름은 [push-notifications](../docs/push-notifications.md)를 본다.

---

## UI 규칙의 위치

[ui-components](./ui-components.md)가 원본이다. 순서는 heroui-native → `shared/ui` → RN이다. 새 UI는 기존 앱 흐름을 유지하고 `shared/ui`와 heroui-native를 바탕으로 한다. Expo 권장 방식을 먼저 본다([Expo 공식 스킬](./ui-components.md#애니메이션과-expo-공식-스킬)). 문구는 [i18n-guide](./i18n-guide.md)(앱 이름 "아이두"/"Aido", 해요체)다.

---

## 넓은 화면과 기기

배치는 창 폭 class(`useWindowSizeClass`)와 `AdaptivePane` 하나로 정한다. 규칙은 [ui-components](./ui-components.md#넓은-화면과-기기)에, 구현은 [adaptive-pane.md](../src/shared/ui/adaptive-pane/adaptive-pane.md)에 있다.

---

## 새 Feature 추가 체크리스트

1. **Model**: `domains/{entity}.model.ts`(모델 스키마·타입 + 순수 함수 + Policy)와 `{entity}.model.test.ts`(Given/When/Then, 경계값). 필요하면 `domains/{feature}.error.ts`, 폼은 `schemas/{name}-form.schema.ts`
2. **Services + Mapper**: `apis/{entity}.mapper.ts`(응답 DTO → 모델), `apis/{feature}.service.ts`
3. **DI 등록**: `di-provider.tsx`에 인스턴스, `di-context.tsx`에 `DIContainer` 필드와 `use{Feature}Service` 훅
4. **Presentations**: `constants/{feature}-query-keys.ts`, `queries/{entity}.queries.ts`, `queries/{entity}.mutations.ts`, 다른 피처가 무효화해야 하면 `queries/{feature}-cache.ts`, `components/`
5. **라우트**: `app/` 아래에 위→아래로 읽히는 화면
6. **테스트**: Model·Policy, Service·Mapper, 자체 로직이 있는 순수 util만
