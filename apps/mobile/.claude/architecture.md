# Mobile App Architecture Guide

**Version**: 2.0.0 · **Last Updated**: 2026-11-06 · **Owner**: Aido Mobile Team

Feature-based Layered Architecture로 만든 React Native/Expo 앱의 규칙이다. 앱에만 해당하는 규칙을 여기에 둔다.

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

## 디렉토리 구조

```
app/                              # Expo Router 화면. 화면 구성이 여기서 읽힌다
src/
├── bootstrap/                    # 앱 조립 (hooks/, navigation/, providers/)
│   └── providers/
│       ├── di-provider.tsx       # 서비스·어댑터 조립 (한 곳)
│       └── di-context.tsx        # DIContainer 타입과 use{X} 훅
├── core/
│   ├── ports/                    # 포트 인터페이스
│   ├── events/
│   └── session/
├── features/{feature}/           # 단수 kebab-case
│   ├── apis/                     # {feature}.service.ts, {entity}.mapper.ts, {name}.repository.ts
│   ├── domains/                  # {entity}.model.ts, {feature}.error.ts, {name}-form.schema.ts
│   ├── constants/                # {feature}-query-keys.ts, 라벨·옵션 상수
│   ├── queries/                  # get-…-query-options.ts, use-…-mutation-options.ts, {feature}-cache.ts
│   ├── components/               # UI 블록과 부모에 결합된 네임스페이스 조각
│   ├── hooks/                    # 단일 책임 훅 (route 읽기, 상태 튜플)
│   ├── utils/                    # 순수 계산, navigation/, view-models/
│   └── __tests__/                # {entity}.factories.ts
└── shared/                       # analytics, config, constants, draft, errors, hooks, i18n,
                                  # infra(어댑터), observability, preferences, providers, types, ui, utils
```

- 로컬 저장소(SecureStore·MMKV)는 `apis/{name}.repository.ts`로 둔다. 위젯의 네이티브 경계는 `features/widget/bridge/`에 둔다.
- 다른 피처는 `@src/features/{feature}/…` 절대 경로로 import한다.
- 폴더 `index.ts` 재수출을 새로 만들지 않고 정의 파일에서 직접 import한다.

## 의존성 흐름

```
Screen(app/) → components·hooks·queries → Service(apis/) → Port(core/ports) ← Adapter(shared/infra)
                                 └──────→ Model·Policy(domains/) ←── Mapper(apis/)
```

의존성은 안쪽(Model)으로 향한다. Model은 Service·UI·SDK를 모른다.

## check:conventions가 막는 것

`pnpm --filter @aido/mobile check:conventions`(`scripts/check-mobile-conventions.mjs`)가 다음을 실패시킨다.

| 검사                    | 내용                                                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| SDK import              | `SDK_MODULES`를 `shared/infra` 밖에서 import. [Port·Adapter·DI](#portadapterdi)                                              |
| 클라이언트 모델         | `CLIENT_OWNED_MODEL_PATHS` 아래에서 `@aido/api` 루트·`contracts/*` import                                                    |
| 엄격한 없음 비교        | 표시 없는 `=== null` 류. [nullish](../../../docs/conventions/nullish.md)                                                     |
| Hermes에 없는 메서드    | `toSorted`, `Array.fromAsync`. typecheck는 통과하고 호출한 순간 앱에서만 죽는다. `jest.setup.ts`도 Node에서 같은 것을 지운다 |
| 테스트 QueryClient      | 테스트에서 `new QueryClient`. `createTestQueryClient`를 쓴다                                                                 |
| 피처 경계               | 다른 피처를 상대 경로로 import                                                                                               |
| `TodoCheckbox`          | `isChecked`·`onCheckedChange` 금지. 원본 `isSelected`·`onSelectedChange`를 쓴다                                              |
| 댓글 route·props·테스트 | [todo-comments](./todo-comments.md)의 경계                                                                                   |

---

## 화면

`app/`의 화면은 위에서 아래로 읽힌다. 파일을 열면 화면 순서, 간격, 로딩·오류 경계가 그대로 보여야 한다. 줄이 길어도 쪼개지 않는다.

기준은 frontend-fundamentals-mock-exam-1의 `SavingsCalculatorPage`다. 파일 구조는 따르지 않고, 서비스는 우리 DI로 받는다.

```tsx
export default function MyPageScreen() {
  const { t } = useTranslation('user');

  return (
    <ScrollView>
      <H3>{t('mypage.header')}</H3>

      <Spacing size={20} />

      <QueryErrorBoundary>
        <Suspense fallback={<ProfileCard.Loading />}>
          <ProfileCard />
        </Suspense>
      </QueryErrorBoundary>

      <Spacing size={12} />

      <QueryErrorBoundary fallback={InviteRewardCard.Error}>
        <Suspense fallback={<InviteRewardCard.Loading />}>
          <InviteRewardCard />
        </Suspense>
      </QueryErrorBoundary>
    </ScrollView>
  );
}
```

- `QueryErrorBoundary`·`Suspense`·`Spacing`을 스크린에 그대로 나열한다. 조각 안으로 숨기지 않는다.
- 넘기기용 래퍼(`MyPagePane.Profile`, `Content → Header → Section`)를 만들지 않는다. 화면 전체를 피처 `pages/`로 옮겨 재수출하지 않는다.
- fallback은 `fallback={X.Error}`, `fallback={<X.Loading />}`로 건다. `fallback={(props) => <X.Error {...props} />}`처럼 감싸지 않는다. `.Error`가 없으면 경계 기본 fallback(다시 시도 + 문의하기)을 쓴다.
- 바깥 여백은 스크린의 `Spacing`이다. `mb`·`mt` 같은 여백 prop을 블록에 넘기지 않는다.
- 스스로 숨는 블록은 간격도 함께 사라져야 한다. 조건을 스크린에서 알 수 있으면 `{isAvailable && (…)}` 안에 간격과 블록을 함께 둔다. 조회해야 알 수 있는 카드만 스크린이 `className`으로 넘긴다(`<PushPermissionCard className="mx-4 mb-3" />`).
- 빈 줄로 구역을 나눈다.
- Suspense 조회나 Provider 소비 때문에 부모가 꼭 필요하면 같은 파일 아래 `Route`가 검증·Provider·전체 경계만 맡는다. `Screen`은 파일 위에 둔다. 경계를 없애려고 query hook을 자기 Suspense 위로 옮기거나 경계를 내비게이터 전체로 넓히지 않는다.
- 가상 목록의 `ListHeaderComponent` 안에도 카드·정렬 바·구분선을 직접 적는다. 헤더를 목록 밖으로 옮기면 스크롤과 첫 위치가 바뀐다. `header`·`ListHeaderComponent`는 자리가 정해진 슬롯이라 이름만 보고 없애지 않는다.
- 정상 목록과 오류 화면이 같은 슬롯 구성을 쓰면 Screen 안의 JSX 상수로 한 번 정의해 공유해도 된다.
- 데이터를 보여 주는 화면은 로딩·오류·빈 상태·데이터 4상태를 그린다. 저장 실패는 입력값을 지우지 않는다.

실제 화면: 내 정보는 탭(`app/(app)/(tabs)/mypage/index.tsx`)과 메뉴 그룹(`app/(app)/(mypage-menu)/_layout.tsx`)이 같은 `MyPagePane`을 두 칸 왼쪽에 그린다. 경계와 간격은 `MyPagePane`에 위에서 아래로 나열돼 있다.

---

## 컴포넌트

### 컴포넌트 계약

**추출은 추상화가 아니다.** JSX를 다른 파일로 옮기기만 하면 읽는 사람이 파일을 오갈 뿐 변경 이유는 줄지 않는다.

| 쓰는 곳                    | 둘 곳                                        |
| -------------------------- | -------------------------------------------- |
| 한 곳                      | 그 파일 아래 지역 컴포넌트                   |
| 두 곳 이상, 같은 피처      | 피처 `components/`의 독립 파일               |
| 부모 없이 의미 없는 조각   | 부모 파일의 네임스페이스(`ProductList.Item`) |
| 함께 바뀌는 목록·행·작성기 | 같은 하위 폴더                               |

이름은 대상과 역할로 짓는다(`AmountInput`, `ProductList`). 위치만 뜻하는 `Header`·`Section`·`Body`는 분리 근거가 아니다. 값을 입력받으면 `…Input`이다(`CategorySelectInput`).

**데이터는 쓰는 컴포넌트가 조회한다.** 화면이 조회해 Props로 내리면 Suspense 경계를 블록 단위로 나눌 수 없다. 목록은 도메인 대신 정책을 Props로 받는다(`filters`, `orderBy`, `limit`).

**화면 id는 route hook에서 읽는다.** `todoId`, `friendId`, search param을 Props로 내리지 않는다. 검증된 `use…ScreenParams()`나 상태 튜플 훅에서 직접 읽는다. 값이 `== null`이면 `.Empty`를 보여 준다. 예외는 목록 행의 id다.

```tsx
export function FriendCalendar() {
  const { friendId } = useFriendScreenParams();
  // friendId로 조회한다
}
```

선택된 대상을 보여 주는 블록은 바깥 컴포넌트가 튜플 훅으로 id를 읽어 `== null`이면 `.Empty`를 돌려주고, 좁혀진 id만 `.Contents`에 넘긴다(`SelectedMemoDetailPane`).

대상이 있는 시트(할 일·하위 항목·카테고리·제안)는 Expo Router 시트 route로 띄운다. 시트가 route hook으로 id를 읽어 캐시에서 조회한다. 폼 상태에 묶인 피커처럼 route 문맥이 없어 `useOverlay`로 띄우는 시트만 값을 Props로 받는다. 계약: `src/shared/ui/bottom-sheet/bottom-sheet.md`.

**컴포넌트는 바깥 레이아웃을 모른다.** margin·폭·위치를 스스로 정하지 않는다. 카드 자신의 모양(`rounded-xl bg-gray-1 px-4 py-3.5`)은 컴포넌트 몫이다.

**Props는 예측할 수 있게 쓴다.** 원본을 확장하면 `Omit<ComponentProps<typeof X>, …>`로 원본 이름을 살린다.

```tsx
interface CategoryColorInputProps extends Omit<ComponentProps<typeof HStack>, 'children'> {
  value: string;
  onChange: (color: string) => void;
}
```

| 대상                                      | 이름                                          |
| ----------------------------------------- | --------------------------------------------- |
| shared `Input`·`TextArea`                 | `value`/`onChange(text)`                      |
| HeroUI `Checkbox`·`Switch`·`ControlField` | `isSelected`/`onSelectedChange`, `isDisabled` |
| `RadioGroup`                              | `value`/`onValueChange`                       |
| 시트·다이얼로그                           | `isOpen`/`onOpenChange`                       |

`disabled`·`selected`·`onToggle`처럼 같은 뜻의 다른 이름을 만들지 않는다.

**래퍼는 역할이 있을 때만 만든다.** `AmountInput`(단위 suffix·숫자 포맷·계산), `PushPermissionDialog`(도메인 문구·권한 요청)처럼 자기 일이 있어야 한다. 역할이 없으면 원본을 쓴다. 상세: [Wrapper Props 계약](./ui-components.md#wrapper-props-계약).

**반복 UI는 나란히 쓴다.** 항목마다 기획이 따로 바뀔 수 있는 표시는 설정 배열을 `map`하지 않고 `CalculationResult`의 `<Record />`처럼 한 줄씩 적는다. 한 줄만 고치면 되게 한다. 서버 항목처럼 데이터로 오는 목록은 `map`·`FlashList`다. 상수로 개수가 정해지는 반복(스켈레톤, `InputOTP.Slot`)은 es-toolkit `times`다.

**네임스페이스는 응집도로 정한다.** `Item`·`Loading`·`Error`·`Empty`는 필수가 아니다. 쓰지 않는 static을 만들지 않는다. 부모에 강하게 결합된 조각(`DailyForecast.TemperatureBar`, `PushPermissionCard.Ask`)도 같은 방식으로 둔다. 파일 안 순서는 본체 → 구성 요소 → `.Loading` → `.Error` → `.Empty`다. 단계별 조각은 본체가 Policy의 step을 `match(step)….exhaustive()`로 고른다.

**변환은 es-toolkit으로 의도를 드러낸다.** `groupBy`, `keyBy`, `partition`, `sumBy`, `orderBy`, `uniqBy`, `clamp`, `times`를 쓴다. 변환은 view-model·utils의 순수 함수에 두고 화면은 결과만 그린다(`notification-list.view-model.ts`). 상호 배타적인 상태는 ts-pattern `match(…).exhaustive()`다. 단순 표시 여부나 두 가지 문구는 `&&`·삼항식이면 된다.

### 목록·스켈레톤

**목록 도구**

- `FlashList`와 `.map`을 고르는 기준은 [ui-components](./ui-components.md#목록-flashlist와-map)에 있다.
- 공용 목록은 원본 계약을 확장한다. `UserList`는 `FlashListProps`에 `hasNextPage`·`isFetchingNextPage`·`fetchNextPage`(TanStack 이름)와 `refreshing`·`onRefresh`(RN 이름)만 더한다.

**목록 컴포넌트**

- 자기 데이터를 `useSuspenseQuery`·`useSuspenseInfiniteQuery`로 구독한다.
- 원본을 그대로 넘기는 `X.Item = (props) => <UserList.Item {...props} />`을 만들지 않는다. 같은 fallback은 `X.Error = UserList.Error`처럼 참조로 잇는다.

**레이아웃 시프트를 만들지 않는다.** 상태가 바뀌어도 자리를 미리 잡아 화면이 튀지 않게 한다.

- `.Loading`은 `.Item`과 같은 레이아웃·슬롯을 쓰고 슬롯만 `Skeleton`으로 채운다.
- 글자 자리는 `TextSkeleton size`(현재 글꼴 배율의 줄 높이), 행 텍스트는 `ListRow.Texts.Loading`이다.
- 데이터에 따라 생기는 줄(설명, 하위 항목)은 그리지 않아 로딩이 끝날 때 위 내용이 밀리지 않게 한다.
- 받은 뒤 나타나는 버튼·배너는 자리를 먼저 비워 둔다.

```tsx
UserList.Loading = function Loading({ rows = 3, right }: UserListLoadingProps) {
  return (
    <ScrollView className="flex-1">
      {times(rows, (index) => (
        <ListRow
          key={index}
          left={<Skeleton className="size-10 rounded-full" />}
          contents={<ListRow.Texts.Loading type="1RowTypeA" />}
          right={right}
        />
      ))}
    </ScrollView>
  );
};
```

### 훅

- `useForm`·`useQuery`·`useMutation`은 쓰는 컴포넌트에서 직접 호출한다. Screen을 짧게 하려고 `useEditor`·`useActions` 같은 포괄 훅에 묶지 않는다.
- 훅은 변화 이유가 하나다(route 읽기, 전환 조정, field focus). 계산은 순수 함수·Policy로 뺀다. 이름 변경이나 코드 이동은 단일 책임이 아니다.
- 훅은 상태·effect·구독을 묶거나 여러 곳이 같은 규칙을 공유할 때만 만든다. 한두 줄을 감싸는 훅이나 파일을 짧게 하려는 훅은 만들지 않는다. `requestAnimationFrame(() => setFocus('title'))`처럼 몇 곳에 반복돼도 짧으면 쓰는 곳에 그대로 쓴다.
- 입력을 여는 칩·행은 폼을 `useFormContext`·`useWatch`·`FormField`로 직접 읽고 쓰며 시트도 직접 연다. 부모에 핸들러를 두고 `value`·`onChange`·`onCloseStart`를 내려보내지 않는다. Props는 부모만 아는 값과 원본 컴포넌트의 props만 받는다. 부모도 같은 동작을 불러야 하면 부모가 소유하고 원본 prop(`onPress`)으로 넘긴다.
- 상태 훅은 `[value, setValue]` 튜플을 돌려준다. 저장소가 URL·MMKV·`useState` 중 무엇이어도 사용처는 그대로다. 이름은 `[selectedTodoId, setSelectedTodoId]`다.
- 쓰지 않는 요소는 비워 두지 않고 `_`를 붙인다(`const [_friendId, setFriendId]`).

### 메모리 누수를 만들지 않는다

- `subscribe`·`add…Listener`는 해제 함수를 돌려주고, `useEffect` cleanup에서 부른다.
- 타이머·디바운스는 cleanup에서 정리한다. es-toolkit `debounce`의 `flush`는 타이머를 남기므로 `cancel`까지 부른다(`useFormDraftAutosave`).
- 음성 인식은 언마운트 때 구독을 풀고 `abort()`한다.
- 서버 GET은 `signal`을 Service → HttpClient까지 넘겨 화면을 떠나면 요청을 멈춘다.

### 기다리지 않는 Promise

`void` 연산자를 쓰지 않는다(Oxlint). 이벤트 핸들러는 Promise를 돌려준다. 기다리지 않는 호출은 실패를 내부에서 처리하는 함수이거나 호출부에서 `.catch`로 기록한다. `.catch(noop)`은 실패가 이미 다른 곳에 보고될 때만 쓴다(mutation `onError`, 쿼리 오류 상태).

---

## 라우팅

- 리소스는 폴더 route다. 세그먼트는 kebab-case, 동적 세그먼트는 `[{entity}Id]`다(`/todo/[todoId]`). `[id]`는 쓰지 않는다.
- 같은 화면의 보기 상태(선택 항목, 필터, 날짜, 친구, 작성기)는 camelCase query param이다(`/feed?friendId=…&date=…`, `/memo?memoId=…`).
- param은 `features/{feature}/hooks/use-…-param(s).ts`에서 `useLocalSearchParams` + zod로 검증해 읽는다. `as`로 건너뛰지 않는다. 타입은 `z.output`에서 얻고 기존 스키마(`feedDateParamSchema`, `routeIntegerStringSchema`, `@aido/api` param 스키마)를 재사용한다.
- `useGlobalSearchParams`를 화면 훅에서 쓰지 않는다. 보이지 않는 화면도 URL이 바뀔 때마다 다시 렌더된다. 레이아웃은 내비게이터와 Provider만 두고 자식 params를 읽지 않는다.
- href는 피처의 순수 함수가 typed 객체로 만든다(`createFeedHref`, `todoActionsSheetHref`, `memoDetailHref`). 경로 문자열을 잇지 않는다. 알림·위젯 목적지는 `utils/navigation` resolver가 이 함수로 정한다.
- 시트 route는 `app/` route가 param을 `safeParse`해 틀리면 `Redirect`하고, 안쪽 컴포넌트는 같은 스키마의 `parse` 훅으로 좁혀진 값을 읽는다.
- 피드는 `/feed` 한 화면이다. 내 피드와 친구 피드는 `friendId` param으로 바뀐다. 친구 전환은 `router.setParams`라 pane이 다시 마운트되지 않고 history가 쌓이지 않는다.
- 메모(`memo`)와 말로 메모(`voice-notes`) 스택은 `slide_from_bottom`이다. `voice-notes`는 녹음을 실수로 잃지 않게 스와이프로 닫지 않는다(`gestureEnabled: false`). 시스템 모달은 토스트·한도 안내가 뒤로 가려져 쓰지 않는다.
- 웹 페이지(약관·공지)는 route가 아니라 `useOpenUrl`(OS 앱 안 브라우저)로 연다. 앱 자체 WebView는 없다. 예전 `aido://webview/…` 링크는 `+not-found`로 간다.

---

## 상태

상태는 원천 하나에만 둔다. 같은 값을 두 저장소에 복사하지 않는다. 계산할 수 있는 값은 상태로 두지 않는다.

| 상태                       | 도구                                                                | 위치·예                                                       |
| -------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------- |
| 서버                       | TanStack Query `queryOptions`·`mutationOptions`, `useSuspenseQuery` | `queries/`. 초안을 캐시에 넣지 않는다                         |
| URL(선택·보기 방식·작성기) | Expo Router params + zod 훅 + href 함수                             | `todoId`, `memoId`, `friendId`. `useState` 사본을 두지 않는다 |
| 기기에 남는 값(MMKV)       | `SyncStorage`·`ObservableSyncStorage` + `useSyncExternalStore`      | `apis/*.repository.ts`                                        |
| 작성 중 초안               | `shared/draft`(암호화 MMKV, 사용자 범위)                            | 댓글·메모. 긴 본문을 URL에 넣지 않는다                        |
| 폼                         | react-hook-form + `zodResolver`, 화면이 소유                        | `domains/*-form.schema.ts`                                    |
| 화면 안 임시 값            | `useState`·`useReducer`·지역 Context                                | 다이얼로그 열림, 측정값                                       |

- pending·error는 이미 주는 곳에서 읽는다. `formState.isSubmitting`·`errors`, mutation·query의 `isPending`·`error`·`variables`를 `useState`로 다시 만들지 않는다.
- 한 컴포넌트에서 서로 독립인 `useSuspenseQuery`를 연달아 부르면 워터폴이다. `useSuspenseQueries`나 블록별 경계로 나눈다. 앞 결과가 다음 조회의 입력일 때만 순차로 둔다.
- 당겨서 새로고침은 `useRefresh`로 사용자가 당긴 동안만 표시한다. 배경 refetch까지 켜지는 `isRefetching`을 쓰지 않는다.

예외:

- 초대 수락 결과: mutation 응답을 다음 화면(환영 시트)에 넘길 때 `queryFn: skipToken` 쿼리(`getRedemptionResultQueryOptions`)에 둔다. 보상·친구 결과를 URL로 넘기면 딥링크로 위조할 수 있다.
- 차단·신고 대상 이름: 사용자 한 명을 id로 조회하는 API가 없어 확인 문구의 이름을 route query(`name`)로 받는다. 표시용이고 판정은 폴더 param의 id로만 한다.

### 폼

- 화면(가장 가까운 session 부모)이 `useForm`, `zodResolver`, 제출 mutation을 소유하고 지역 `FormProvider`로 넘긴다. `shared/ui/form-field`의 `FormField`만 `Controller`를 소유한다.
- 하위는 `useWatch({ name })`·`useFormState({ name })`로 자기 값만 구독한다. 폼 값을 전역 상태에 복사하지 않는다.
- `useForm`은 제네릭 없이 `resolver`에서 타입을 추론한다(`@hookform/resolvers` 권장). 스키마가 변환 없이 입력과 출력이 같으면 타입은 `z.infer` 하나로 쓴다.
- 처음 값은 스키마의 `.default()`가 아니라 `defaultValues`에 둔다. 값이 없는 칸은 `undefined`가 아니라 `null`이다(RHF가 `undefined` 기본값을 권장하지 않고, 앱 모델의 "없음"도 `null`이다). 그래서 `?? null`·`?? undefined` 변환이 필요 없다.
- 새로 만들거나 고치는 폼 스키마는 계약 스키마를 가져다 쓰지 않고 `@aido/api/vocabulary`의 상수로 만든다.
- 생성과 수정은 같은 폼·스키마·컴포넌트를 쓴다. 차이는 `defaultValues`와 제출 변환뿐이다.
- 저장 가능 여부는 스키마와 `formState.isValid`로 판단한다. 같은 규칙을 함수로 또 만들지 않는다.
- 렌더 경로에서 `getValues()`를 읽지 않는다. `reactCompiler: true`라 값이 캐시돼 갱신되지 않는다. jest는 컴파일러 없이 돌아 이 버그를 못 잡으므로 시뮬레이터에서 확인한다. `getValues()`는 이벤트 핸들러에서만 쓴다.

### 초안

- 초안은 `useDraftStorage(draftKey)`가 첫 렌더에 한 번 동기로 읽어 `defaultValues`에 넣는다. 빈 값으로 그린 뒤 채우지 않는다.
- `useFormDraftAutosave(form.subscribe, …)`가 렌더 없이 디바운스 저장한다. 언마운트(폴더블 전환) 때 대기 중인 저장을 flush하고, 제출 성공·취소는 반환된 함수로 대기 저장까지 취소한 뒤 지운다.
- 키는 피처의 순수 함수(`createTodoCommentDraftKey`, `createMemoDraftKey`)가 `createDraftKey`로 만든다. 사용자 id가 항상 들어간다.
- 명시적 로그아웃·탈퇴 때만 `AuthProvider`가 초안을 모두 지운다. 세션 만료는 초안을 남겨 같은 사용자가 이어 쓰게 한다. 로그인 후 `useUserIdentity`가 다른 소유자의 초안을 지운다. 7일 지난 초안(`DRAFT_TTL_MS`)은 앱 시작 때 정리한다.
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

| 필요한 것   | 도구                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------- |
| 오늘·자정   | `LocalDateProvider` + `useToday`·`useTodayKey`. render 중 `new Date()`를 기준으로 쓰지 않는다 |
| 분 단위     | `useMinuteNow`                                                                                |
| 날짜 key    | `date-key.ts`(`toDeviceDateKey`, `addDaysToDateKey`)                                          |
| 주          | `calendar-week.ts`(`getCalendarWeekOfDateKey`)                                                |
| 표시        | `date-format.ts`(`formatDateKeyLabel`, `formatDateLabel`) + `useDateFormatContext`            |
| 시각·시간대 | `time.ts`, `timezone.ts`                                                                      |

---

## 모델과 Policy

```
features/{feature}/domains/
├── {entity}.model.ts    # Zod 모델 + 이름 있는 순수 함수 + {Entity}Policy
└── {feature}.error.ts   # 기능 오류. [에러 처리] 참고
```

모델 파일 하나에 다 둔다. 규칙이 바뀌면 함수 하나만 고쳐 사용처가 모두 바뀌게 한다. 모델을 불필요하게 여러 개 만들지 않는다. 참고: frontend-fundamentals-mock-exam-1 `saving-product.model.ts`.

```typescript
export const pushPermissionSchema = z.object({
  status: z.enum(PUSH_PERMISSION_STATUS),
  canAskAgain: z.boolean(),
});

export function isDeliveryAllowed(permission: PushPermission): boolean {
  // GRANTED 또는 PROVISIONAL
}

export const PushPermissionPolicy = {
  isDeliveryAllowed,
  isNotDetermined,
  canRequestSystemDialog,
} as const;
```

**이름은 동사로 시작한다.** `get*`(값 읽기·파생), `calculate*`(계산), `is*`·`has*`·`can*`·`should*`(판정), `find*`(검색), `create*`(생성), `with*`(불변 갱신). `xxxOf`는 쓰지 않는다(`getDisplayState`, `getSelectedActions`). Facade 키는 export한 함수 이름 그대로다. 별칭을 두지 않아야 검색 한 번에 정의와 사용처가 나온다.

**첫 인자는 모델이다.** `comment` 규칙이면 첫 인자는 `comment`다(`canDeleteComment(comment)`). 흩어진 필드 나열이나 DTO를 받지 않는다.

**Policy는 비즈니스 규칙만 담는다.**

- 문구·아이콘·색·레이아웃·i18n 키를 돌려주지 않는다. 등급·단계 같은 의미 값을 돌려주고 컴포넌트가 `satisfies Record<Grade, …>` 맵이나 `match`로 그린다.
- 화살표 함수 본문을 Facade에 인라인으로 쓰지 않는다. 이름 있는 함수가 테스트 단위다.
- 현재 시각은 인자로 받는다. `Date.now()`·`new Date()`를 호출하지 않는다.
- 다른 피처의 Policy를 재수출하거나 위임만 하는 함수를 두지 않는다.
- class로 만들지 않는다.

**앱은 서버 값을 다시 계산하지 않는다.** 남은 횟수·한도·리셋 시각처럼 서버가 계산한 값은 그대로 쓴다.

**Zod는 최신 문법만 쓴다.** `z.int()`, `z.iso.date()`·`z.iso.time()`, `z.email()`·`z.url()`, `z.partialRecord`, `z.discriminatedUnion`, `z.enum(튜플)`, `.brand<'X'>()`. `z.nativeEnum`, `z.string().email()`, `.passthrough()`, `.strict()`는 쓰지 않는다.

### 서버 응답과 모델

모델은 서버 응답 모양에 의존하지 않는다. 서버 필드가 바뀌면 mapper만 고친다. 서버 이름을 모델에 그대로 옮기지 않아도 된다.

| `@aido/api` 진입점                        | 내용                                   | import할 수 있는 곳                          |
| ----------------------------------------- | -------------------------------------- | -------------------------------------------- |
| `@aido/api/vocabulary`                    | 용어 튜플·상수·한도(`DAYS_OF_WEEK` 등) | 어디서나(모델 스키마 `z.enum(DAYS_OF_WEEK)`) |
| `@aido/api/errors`                        | `ErrorCode`                            | 어디서나                                     |
| `@aido/api`(루트)·`@aido/api/contracts/*` | 요청·응답 스키마와 DTO 타입            | `apis/*.service.ts`·`apis/*.mapper.ts`만     |

- 옮긴 모델은 `CLIENT_OWNED_MODEL_PATHS`에 올린다. 아직 옮기지 않은 모델의 `@aido/api` 재사용은 손댈 때 함께 옮긴다.
- mapper는 계약 enum·유니온을 `satisfies Record<ContractEnum, …>`나 `exhaustive()`로 빠짐없이 매핑한다. 서버가 값을 더하면 빌드가 깨져 놓치지 않는다.
- brand·enum은 mapper가 `schema.parse`로 붙인다. `as`로 단정하지 않는다.
- 응답을 읽을 때 새 필드는 없을 수 있다(구 서버와 섞임). `== null`로 처리한다.
- 모델 테스트는 `*.model.test.ts`에서 `createX(overrides)`로 경계값까지 확인한다. mapper fixture는 계약 스키마로 검증해 만든다(`todoCommentThreadsResponseSchema.parse({ … })`). 계약과 어긋난 fixture로 통과하는 테스트를 막는다.

---

## Service와 Mapper

Service는 포트를 주입받아 HTTP 호출 + Zod 검증 + Mapper 변환 + Policy 검증을 한다. `ApiError`는 번역하지 않고 그대로 넘긴다. 메서드는 arrow class field, private은 `#`다.

```typescript
export class {Feature}Service {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  create{Feature} = async (params: Create{Feature}Input): Promise<Result<{Feature}, {Feature}ServiceError>> => {
    if (!{Feature}Policy.isValidInput(params.name)) {
      return err({Feature}Errors.invalidInput());
    }

    const result = await this.#httpClient.post('v1/{feature}s', params);
    if (!result.ok) {
      return result;
    }

    const parsed = {feature}ResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[{Feature}Service] Invalid create{Feature} response: ${parsed.error.message}`);
    }

    return ok(to{Feature}(parsed.data));
  };
}
```

- `HttpClient`의 성공 값은 `unknown`이다. 응답 타입을 generic으로 단정하지 않고 공유 스키마로 전부 검증한다.
- Mapper는 DTO·OS 값을 모델로 바꾸는 유일한 지점이고 순수 함수다.
- 컴포넌트는 `HttpClient`나 `Result`를 직접 다루지 않는다. `{feature}Service`와 `unwrap`을 거친다.

---

## Query와 Mutation

```
HTTP(unknown)
  → Service: @aido/api 스키마 safeParse → ParseError
  → Mapper: DTO → 클라이언트 모델   ← 서버 스펙 변경은 여기만 고친다
  → Query 캐시: 클라이언트 모델
  → select: 필터·정렬·표시 모델      ← 구독하는 화면별 파생
  → Component: Policy 호출 + 표시
```

```typescript
// queries/get-memo-query-options.ts
export function getMemoQueryOptions(memoService: MemoService, { memoId }: { memoId: number }) {
  return queryOptions({
    queryKey: MEMO_QUERY_KEYS.detail({ memoId }),
    queryFn: async ({ signal }) => unwrap(await memoService.getMemo(memoId, signal)),
  });
}

export function useGetMemoQueryOptions({ memoId }: { memoId: number }) {
  return getMemoQueryOptions(useMemoService(), { memoId });
}
```

- 컴포넌트는 `useSuspenseQuery(useGet…QueryOptions(…))`처럼 사용처에서 바로 부른다. `queryKey`·`enabled`를 재사용할 때만 지역 변수에 둔다.
- query key·queryFn·캐시 정책을 컴포넌트에 인라인으로 만들지 않는다. 키를 하드코딩하지 않는다.
- 인자는 이름 있는 객체로 받고 query key에도 같은 객체를 넣는다. 서버 GET은 `signal`을 넘긴다.
- 키 이름에 피처 접두사를 반복하지 않는다. 다른 피처의 캐시는 그 피처의 `{feature}-cache.ts` 함수로만 무효화한다.
- select는 서버 스키마를 변환하지 않는다. 캐시에 DTO가 남으면 낙관적 업데이트가 서버 모양을 알아야 한다.
- select 함수는 순수하고 참조가 안정적이어야 한다. 모듈 수준 함수를 우선한다. 인라인 화살표는 render마다 다시 실행된다.
- 클라이언트 필터는 key에 넣지 않고 select로 같은 캐시를 공유한다. 서버 파라미터는 key에 넣는다.
- `mutationFn`은 반드시 `unwrap()`한다. `Result.err()`를 돌려주면 React Query가 성공으로 보고 `onSuccess`를 부른다. 오류 분기는 [에러 처리](../docs/error-handling.md)를 본다.

### 할 일 목록의 낙관적 갱신

`features/todo/queries/todo-cache.ts` 한 곳의 규칙을 따른다.

- 날짜는 할 일의 `startDate`가 아니라 보고 있는 목록의 `date`다. 여러 날 할 일은 여러 날짜 목록에 있다.
- `onMutate`: `cancelTodoQueries`(달력까지 바꾸면 `cancelTodoCompletionQueries`)로 조회를 멈추고 `updateCachedTodo`로 목록·상세를 함께 고친다. 달력은 `syncDailyCompletionWithList`로 목록에서 다시 계산한다.
- `onError`: 스냅샷을 통째로 덮지 않고 그 변경만 되돌린다. 통째로 덮으면 함께 진행 중인 다른 변경을 지운다.
- `onSettled`: `mutationKey`에 `TODO_MUTATION_KEYS`를 두고 `settleTodoListWrite`·`settleTodoCompletionWrite`만 부른다. 마지막 뮤테이션이 끝날 때만 다시 받아야 낙관적 값이 되돌아가지 않는다.
- 임시 id는 음수다(`createOptimisticId`). 임시 행은 `TodoPolicy.isOptimisticTodo`·`SubTodoPolicy.isOptimisticSubTodo`로 막고, 응답이 오면 다시 받기 전에 서버 id로 바꾼다.

---

## 오류와 관측

- 오류 분류와 처리는 [에러 처리](../docs/error-handling.md)가 원본이다. 요약: 예측 가능(4xx, Policy)은 `Result.err()` → mutation `onError`, 예측 불가(5xx, 네트워크, 파싱)는 `throw` → 조회는 `QueryErrorBoundary`, mutation은 기본 토스트다. 한 오류는 토스트와 fallback 중 한 곳에서만 보인다.
- 로깅은 Sentry(`Logger`·`ErrorReporter`, 이벤트 키)와 GA(`useTrack`, `AppEventMap`) 양쪽을 일관되게 남긴다. 실패를 조용히 삼키지 않는다. 상세: [observability](./observability.md).

---

## Port·Adapter·DI

```
core/ports (인터페이스) ← shared/infra (어댑터) ← di-provider (조립) → di-context (use{X} 훅) → 컴포넌트·쿼리
```

왜 이렇게 하나:

1. **라이브러리를 쉽게 바꾼다.** 앱 코드는 포트만 안다. 라이브러리를 바꾸면 어댑터 파일과 `di-provider`만 바뀐다. 어댑터 밖이 바뀌면 포트 설계가 틀린 것이다.
2. **실제와 가깝게 테스트한다.** `jest.mock`으로 모듈을 가로채지 않고 포트 stub만 끼운다. 서비스·모델·화면은 실제 코드가 돈다. [testing-guide](./testing-guide.md#stub-우선-di-테스트).
3. **기기에 없는 상황을 만든다.** 마이크 없는 시뮬레이터, 전화로 끊긴 인식, 결제 실패를 구현체 교체로 재현한다.

stub 테스트가 통과해도 실제 SDK·OS 동작은 보장하지 않는다(Hermes에 없는 메서드, 기기별 인식기 차이). 그 부분은 실기기 QA로 확인한다.

### 규칙

- **SDK는 `shared/infra`에서만 import한다.** 한 줄짜리 호출이어도 어댑터를 거치고, 쓰는 쪽은 `use{X}` 훅으로 받는다. 다른 개발자가 헷갈리지 않게 일관성을 우선한다.
- **예외는 두 가지뿐이다.**
  - 라이브러리 자체가 React 훅이면 경계 훅 파일 하나에서만 import한다(`expo-audio`는 `use-voice-note-player.ts`, `expo-keep-awake`는 `shared/infra/keep-awake/use-keep-screen-awake.ts`). `shared/infra` 밖의 경계 훅은 `SDK_BOUNDARY_HOOKS`에 올린다.
  - React 밖 코드(시작 시 값, 위젯 진입점, 부트스트랩)는 DI 훅을 부를 수 없으니 `shared/infra`의 함수를 직접 import한다.
- **`check:conventions`가 강제한다.** 규칙 전부터 있던 파일은 `SDK_IMPORT_ALLOWLIST`에 있고 출시 후 첫 스택에서 비운다. 새 위반을 더하지 않는다.
- **포트 이름은 앱의 말로 짓는다.** SDK·공급자 이름을 쓰지 않는다(`setFirebaseAppInstanceId` → `setAnalyticsId`, `setString` → `copy`).
- **포트에는 앱이 필요한 기능만 둔다.** SDK 타입을 밖으로 내보내지 않고 plain 값으로 넘긴다.
- **조립은 `di-provider.tsx` 한 곳이다.** 서비스·저장소를 다른 곳에서 `new` 하지 않는다.
- **Mapper는 DI에 넣지 않는다.** 순수 함수라 서비스가 직접 import한다.

### 대표 포트

전체 목록은 `core/ports/`에 있다.

| 포트                      | 메서드 이름                                                                 | 어댑터 (`shared/infra/`)                         |
| ------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------ |
| `HttpClient`              | `get`·`post`·`put`·`patch`·`delete`                                         | `http/ky-client.ts`                              |
| `Storage`                 | `get`·`set`·`remove`·`clear`                                                | `storage/secure-storage.ts`                      |
| `SyncStorage`             | `get`·`set`·`remove`                                                        | `storage/mmkv-storage.ts`                        |
| `EnumerableSyncStorage`   | `SyncStorage` + `keys`·`clear`                                              | `storage/mmkv-draft-storage.ts`                  |
| `ObservableSyncStorage`   | `SyncStorage` + `subscribe`                                                 | `storage/mmkv-storage.ts`                        |
| `ClipboardGateway`        | `copy`·`paste`·`hasContent`                                                 | `clipboard/expo-clipboard.gateway.ts`            |
| `LocationGateway`         | `getPermission`(`isGranted`, `canAskAgain`)·`getCoordinates`·`getPlace`     | `location/expo-location.gateway.ts`              |
| `PurchasesGateway`        | `purchase`·`restore`·`getOffering`·`getStatus`·`subscribe`·`setAnalyticsId` | `purchases/revenuecat-purchases.gateway.ts`      |
| `SpeechRecognizer`        | `start`·`stop`·`abort`·`subscribe` 등                                       | `speech/expo-speech-recognizer.gateway.ts`       |
| `PushNotificationGateway` | `getPermission`·`requestPermission`·`getToken` 등                           | `notification/expo-push-notification.gateway.ts` |
| `HapticsGateway`          | `selection`·`impact`·`notify`                                               | `haptics/expo-haptics.gateway.ts`                |
| `NetworkStatusGateway`    | `subscribe`                                                                 | `network/expo-network-status.gateway.ts`         |
| `IdGenerator`             | `create`                                                                    | `id-generator/expo-id-generator.ts`              |
| `Logger`                  | `debug`·`info`·`warn`·`error`                                               | `logger/`                                        |
| `Analytics`               | `trackEvent`·`trackScreenView` 등                                           | `analytics/`                                     |
| `ErrorReporter`           | `captureException`·`captureMessage`·`addBreadcrumb`                         | `error-reporter/`                                |

`core/ports/`는 관측 키 타입을 위해 `shared/observability/telemetry-keys`를 `import type`으로만 참조할 수 있다.

### 케이스별 사용법

| 필요한 것                | 방식                               | 꺼내는 훅 예시                       |
| ------------------------ | ---------------------------------- | ------------------------------------ |
| 일회성 네이티브 기능     | 포트 + 어댑터                      | `useClipboard()`, `useHaptics()`     |
| 서버 데이터              | `HttpClient` → 서비스 → 쿼리 옵션  | `useGetMemoQueryOptions()`           |
| 로컬 저장값              | `SyncStorage` → 저장소 → 서비스    | `usePushPromptService()`             |
| 값 하나 읽고 쓰는 저장소 | `SyncStorage` → 저장소             | `useRecognitionLanguageRepository()` |
| 이벤트 스트림            | 포트의 `subscribe`, 해제 함수 반환 | `useSpeechRecognizer()`              |
| 관측                     | 포트                               | `useLogger()`, `useAnalytics()`      |

### 예: 클립보드

```typescript
// core/ports/clipboard.ts
export interface ClipboardGateway {
  hasContent(): Promise<boolean>;
  paste(): Promise<string>;
  copy(text: string): Promise<void>;
}

// shared/infra/clipboard/expo-clipboard.gateway.ts
import * as Clipboard from 'expo-clipboard';

export const expoClipboardGateway: ClipboardGateway = {
  hasContent: () => Clipboard.hasStringAsync(),
  paste: () => Clipboard.getStringAsync(),
  copy: async (text) => {
    await Clipboard.setStringAsync(text);
  },
};

// bootstrap/providers/di-provider.tsx
clipboard: expoClipboardGateway,

// bootstrap/providers/di-context.tsx
export const useClipboard = () => useDI().clipboard;

// 컴포넌트
const clipboard = useClipboard();
await clipboard.copy(comment.content ?? '');
```

### 포트별 참고

- **음성 인식**: 화면은 `SpeechRecognizer`의 `mode`(`dictation`·`quick`·`note`)만 고른다. 연속 인식·기기 안 인식·문장부호·음량 정규화·녹음 파일 옵션은 어댑터가 정한다. 인식 이벤트는 앱 전체에 하나라 `subscribe`한 쪽이 자기가 시작한 세션의 이벤트만 쓴다.
- **결제**: `PurchasesGateway`는 RevenueCat 타입 대신 plain 값과 `PurchasesGatewayError(kind, storeErrorCode)`만 넘긴다. `subscription.mapper.ts`가 모델로 바꾼다.
- **푸시**: 서비스는 게이트웨이가 준 OS 원본(`PushPermissionResponse`)을 `push-permission.mapper.ts`로 모델에 바꾼 뒤에만 Policy에 넘긴다. 흐름은 [push-notifications](../docs/push-notifications.md)를 본다.

---

## UI 규칙의 위치

[ui-components](./ui-components.md)가 원본이다. 순서는 heroui-native → `shared/ui` → RN이다. 새 UI는 기존 앱 흐름을 유지하고 `shared/ui`와 heroui-native를 바탕으로 한다. Expo 권장 방식을 먼저 본다([Expo 공식 스킬](./ui-components.md#애니메이션과-expo-공식-스킬)). 문구는 [i18n-guide](./i18n-guide.md)(앱 이름 "아이두"/"Aido", 해요체)다.

---

## 넓은 화면과 기기

- **창 폭으로 판단한다.** 1열·2열은 `useWindowSizeClass`(`compact`·`medium`·`expanded`)로 정한다. 기기 종류나 힌지로 레이아웃을 나누지 않는다.
- **2열은 `AdaptivePane` 하나다.** 접기·펼치기에서 pane이 다시 마운트되지 않는다. 접힘선은 경계 위치만 맞춘다(`findVerticalFold`). 상세: [adaptive-pane.md](../src/shared/ui/adaptive-pane/adaptive-pane.md).
- **Duo 세로 레일은 safe area inset으로 피한다.** [가로 safe area](./ui-components.md#가로-safe-area-iphone-duo-세로-레일)를 따른다.
- **Mac(Designed for iPad)은 항상 `compact`다.** 제품 결정이다(`IS_IOS_APP_ON_MAC`).
- **`SplitView`·`ArrangementView`는 쓰지 않는다.** 1.15.0에서 시험했고 다음 버전에 다시 본다. [이유](../src/shared/ui/adaptive-pane/adaptive-pane.md#splitviewarrangementview를-쓰지-않는-이유).

---

## 새 Feature 추가 체크리스트

1. **Models**: `domains/{entity}.model.ts`(Zod 모델 + 순수 함수 + Policy), 필요하면 `domains/{feature}.error.ts`
2. **Services + Mapper**: `apis/{entity}.mapper.ts`, `apis/{feature}.service.ts`
3. **DI 등록**: `di-provider.tsx`에 인스턴스, `di-context.tsx`에 `DIContainer` 필드와 `use{Feature}Service` 훅
4. **Presentations**: `constants/{feature}-query-keys.ts`, `queries/get-…-query-options.ts`, `queries/use-…-mutation-options.ts`, 다른 피처가 무효화해야 하면 `queries/{feature}-cache.ts`, `components/`
5. **라우트**: `app/` 아래에 위→아래로 읽히는 화면
6. **테스트**: Model·Policy, Service·Mapper, 자체 로직이 있는 순수 util만
