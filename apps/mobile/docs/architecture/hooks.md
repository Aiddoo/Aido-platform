# 훅

한 훅은 한 책임이고, 같은 일은 공용 훅 하나로 한다. params 튜플 훅과 상태 원천은 [state-and-routing](./state-and-routing.md), 쿼리·mutation 옵션 훅은 [data](./data.md), 폼은 [forms](./forms.md)에 있다. 아직 이 모양이 아닌 훅은 [다음 버전 후보 이슈(#1785)](https://github.com/Aiddoo/Aido-platform/issues/1785)에 있다.

## 규칙

**만들 때**

- 훅은 상태·effect·구독을 묶거나 여러 곳이 같은 규칙을 공유할 때만 만든다. 한두 줄을 감싸거나 파일을 짧게 하려는 훅은 만들지 않는다.
- 바뀌는 이유가 하나다(route 값 하나, 구독 하나, 전환 조정, 칸 포커스). 계산은 순수 함수·Policy로 빼고 훅은 부르기만 한다.
- 포괄 훅(`useEditor`, `useActions`, 조회·mutation·이동·토스트·분석을 함께 가진 훅)을 만들지 않는다. 책임이 둘이면 훅도 둘이다.
- `useForm`·`useSuspenseQuery`·`useMutation`은 쓰는 컴포넌트에서 직접 부른다. 라이브러리 훅을 역할 없이 감싸지 않는다(`useMemos = () => useSuspenseQuery(…)`, 폼 값을 잇기만 하는 `useImportRange(form)`). 감싸는 훅은 규칙을 더할 때만 만든다(두 번 탭 방지, 화면 포커스와 묶기, 추적 한 곳).
- 진행·오류 상태를 `useState`로 만들지 않는다. 비동기 동작은 `useMutation`의 `isPending`·`error`를 쓴다.

**반환과 이름**

| 훅                        | 반환                   | 예                                                                                |
| ------------------------- | ---------------------- | --------------------------------------------------------------------------------- |
| 상태·route 값             | 튜플. 읽기 전용도 튜플 | `[view, setView]`, `[{ goalAmount, monthlyAmount }, setSavingParams]`, `[todoId]` |
| 계산·구독 값(저장소 없음) | 값                     | `useIsOnline()` → `boolean`, `useNow()` → `Instant`                               |
| 동작 하나                 | 함수                   | `useGoBack()` → `() => void`, `useOpenAppSettings()` → `() => Promise<void>`      |
| 동작 묶음                 | 이름 있는 객체         | `usePushPermissionAction()` → `{ runStep, isPending }`                            |
| 세 갈래 이상 상태         | 유니온 값 하나         | `usePushOnboardingGuardState()` → `'open' \| 'closed' \| 'pending'`               |

- 튜플이면 저장소(URL·저장 값·`useState`)를 바꿔도 훅 반환만 고친다. 이름은 값을 드러내고(`[selectedMemoId, setSelectedMemoId]`), 쓰지 않는 요소는 `_`를 붙인다.
- Suspense로 멈추는 훅은 `useSuspense{X}`다(`useSuspenseMyAccountId`). 불리언은 `useIs{X}`·`useHas{X}`다. 반대 뜻 불리언 훅 두 개(`useIsXOpen`·`useIsXClosed`)를 만들지 않는다.

**인자와 타입**

- 옵션은 이름 있는 객체 하나다(`useAndroidBackHandler({ isEnabled, onBack })`). 위치 인자 여럿과 위치 불리언을 쓰지 않는다. 인증 상태는 `{ authStatus }`로 받는다.
- 인자·props 타입에 `ReturnType<typeof useX>`를 쓰지 않고 이름 있는 interface를 둔다. 훅 안이 바뀌어도 받는 쪽 타입이 흔들리지 않는다.

**파일과 위치**

- 한 곳만 쓰는 훅은 쓰는 파일 아래 지역 훅이다(화면만 쓰는 route 값 훅도 그 route 파일 안). 파일을 따로 두는 경우는 [structure의 공개 면](./structure.md#공개-면)과 같다. 제품 말 없이 설명되고 두 기능 이상이 쓰면 `shared/`다.
- 파일 이름은 export의 kebab-case다(`usePushPermissionAction` → `use-push-permission-action.ts`). 파일 하나에 공개 훅 하나다. 같은 params 스키마의 튜플 훅은 `hooks/use-{name}-params.ts` 하나에 모으고, 같은 원천(store·Context·저장소)을 다른 모양으로 읽는 짝(`useMarkPushOnboardingGuardRendered`·`usePushOnboardingGuardState`)은 한 파일에 둔다. 읽으면서 effect로 store에 쓰는 훅은 쓰기가 드러나는 동사(`useMark…`)로 짓는다.
- 훅이 아닌 export(순수 함수, 상수, 로그 키)는 `utils/`·`constants/`에 둔다.

**effect**

- effect 안에서 최신 콜백은 `useEffectEvent`로 읽는다. deps에 넣어 구독·타이머를 다시 걸지 않는다.
- 구독·타이머·await 뒤 처리는 [data의 메모리와 수명](./data.md#메모리와-수명)을 따른다. `AppState`·`BackHandler`를 직접 듣지 않고 `useOnAppForeground`·`useAndroidBackHandler`를 쓴다.

## 공용 훅

새로 만들기 전에 이 표를 본다. 같은 일을 하는 훅이 있으면 그것을 쓰고, 모양이 맞지 않으면 그 훅을 고친다. 글꼴(`useFontScaledSize`·`useFontScaleRatio`)과 창 크기(`usePaneSizeClass`·`useWindowSizeClass`)는 [ui](./ui.md#글꼴과-기기), 오늘·시계(`useTodayKey`·`useMinuteNow`·`useNow`)는 [날짜](../dates-and-i18n.md#오늘과-시계)에 있다.

| 훅                                                              | 자리                                  | 모양                                                                                                                     | 없애는 복제                                                                |
| --------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `useGoBack({ fallbackHref } \| { onFallback })`                 | `shared/hooks`                        | `() => void`(두 번 탭 방지)                                                                                              | `canGoBack ? back : replace`, 구독 시작 화면 완료(`onFallback`)            |
| `useAndroidBackHandler({ isEnabled, onBack })`                  | `shared/hooks`                        | `void`(`useEffectEvent`, 화면 포커스와 묶음)                                                                             | `BackHandler` 직접 구독                                                    |
| `useOnAppForeground(onForeground)`                              | `shared/hooks`                        | `void`(AppLifecycle 포트)                                                                                                | `AppState` 직접 구독                                                       |
| `useAppLifecycleState()`                                        | `shared/hooks`                        | `AppLifecycleState`(AppLifecycle 포트 구독 하나)                                                                         | `useSyncExternalStore(appLifecycle…)`                                      |
| `useOnScreenBlur(onBlur)`                                       | `shared/hooks`                        | `void`(화면이 가려질 때, 닫힐 때는 부르지 않음)                                                                          | `useIsFocused` + effect                                                    |
| `useNow({ tickMs, until })`                                     | `shared/hooks`                        | `Instant`                                                                                                                | 지금 시계                                                                  |
| `useMinuteNow()`                                                | `shared/hooks`                        | `Instant`(앱 하나의 분 시계 구독, 상대 시간·날짜 판단)                                                                   | 행마다 거는 분 타이머                                                      |
| `useLocaleContext()`                                            | `shared/hooks`                        | 앱 언어 + `APP_LOCALES` 항목                                                                                             | 언어 매핑                                                                  |
| `useAppWindow()`                                                | `shared/hooks`                        | `{ width, height, os, isDesktop }`                                                                                       | `useWindowDimensions`·`EXPO_OS`·Mac 판정 직접 조합                         |
| `useDismissKeyboard()`                                          | `shared/hooks`                        | `({ animated }?) => void`(keyboard-controller로 내리고 포커스를 푼다, 실패는 로그)                                       | `Keyboard.dismiss()`·`KeyboardController.dismiss().catch(로그)` 직접 호출  |
| `useOnOpenTransitionEnd(onOpened, { isStackRoot })`             | `shared/hooks`                        | `void`(열리는 전환이 끝나면, 가려져 있으면 부르지 않음)                                                                  | `useNavigation<…>()`으로 좁힌 `transitionEnd` 구독(검색창·편집기 포커스)   |
| `useIsReduceMotionEnabled()`·`useIsReduceTransparencyEnabled()` | `shared/hooks`                        | `boolean`(OS 접근성 설정 하나를 구독 하나로 읽고 앱이 떠 있는 동안 바뀐 값도 따른다)                                     | `AccessibilityInfo` 직접 읽기·구독                                         |
| `useMinimumFontScale(size)`                                     | `shared/hooks`                        | `adjustsFontSizeToFit`의 `minimumFontScale`(11pt 아래로 줄이지 않음)                                                     | 글꼴 단계별 최소 배율 계산                                                 |
| `useCopyToClipboard()`                                          | `shared/hooks`                        | `copy(text, { successMessage, failureMessage })`                                                                         | 클립보드 + 토스트 + 실패 로그(`useCopiedFeedback`은 아이콘 타이머라 따로)  |
| `useOpenAppSettings()`                                          | `shared/hooks`                        | `{ canOpen, open }`(Mac은 `canOpen` false, `open`은 실패를 로그로 남기고 결과로 알림)                                    | 설정 앱 열기([권한](../permissions.md))                                    |
| `useOpenDetailWhenCompact(selectedId, openDetail)`              | `shared/hooks`                        | `void`(좁은 화면에서 포커스를 받으면 고른 항목의 상세를 연다)                                                            | 목록·상세 칸 전환 effect                                                   |
| `useRetainedValue(value)`                                       | `shared/hooks`                        | `T \| null`(값이 사라져도 마지막 값)                                                                                     | 삭제 직후 닫히는 시트의 내용 보관                                          |
| `useReorderableList(options)`                                   | `shared/hooks`                        | `react-native-reorderable-list` props(끌기 지연, 임시 행 잠금, 순서 지시)                                                | 끌어서 순서 바꾸기 연결                                                    |
| `useMutationErrorFeedback()`                                    | `shared/query`                        | `(error, { feature, fallbackKey?, title?, description? }) => void`(전역 mutation 피드백과 같은 햅틱·토스트·보고 한 번)   | `errorFeedback: false` mutation·일괄 작업의 햅틱 + `toast.error` 직접 복제 |
| `useReportUnexpectedError(feature)`                             | `shared/hooks`                        | `(error) => void`(예상하지 못한 오류만, 요청 태그 포함)                                                                  | mutation·조회 밖 실패(기기 작업)의 `captureException` 직접 호출            |
| `useLayoutSize()`                                               | `shared/hooks`                        | `[size \| null, onLayout]`(재기 전 `null`, 첫 프레임은 `size?.width ?? 어림값`)                                          | `onLayout` → `setSize` 직접 구현                                           |
| `useRebuiltPath(read, draw)`                                    | `shared/hooks`                        | `SharedValue<SkPath>`(읽은 값·`draw`가 바뀔 때만 다시 그림, 빌더 하나를 되씀)                                            | Skia 경로 다시 만들기                                                      |
| `useToggleableFrameCallback(callback, { isActive })`            | `shared/hooks`                        | `void`(켜짐이 바뀌면 `setActive`로 따라가고 내려가면 끈다)                                                               | `useFrameCallback(…, false)` + `setActive` effect                          |
| `useSkiaDensityScale()`                                         | `shared/hooks`                        | `number`(지금 화면 배율 ÷ Android Skia가 앱을 켤 때 굳힌 배율)                                                           | Canvas마다 `PixelRatio`·`useWindowDimensions().scale` 비교                 |
| `useIsUnmountedRef()`                                           | `shared/hooks`                        | `RefObject<boolean>`(await 뒤에 읽는다. effect가 다시 돌면 다시 붙은 것으로 본다)                                        | 훅마다 따로 둔 `isUnmountedRef`·`isMountedRef` effect                      |
| `useOpenSheet()`                                                | `shared/ui/overlay`                   | `openSheet(render, options)` → `Promise<T \| undefined>`(취소·끌어 내림은 `undefined`)                                   | overlay + `ModalBottomSheet` 직접 연결                                     |
| `useOpenKeyboardSheet()`                                        | `shared/ui/overlay`                   | `openKeyboardSheet(({ isOpen, onOpenChange, close }) => …)`                                                              | `KeyboardBottomSheet`를 그리는 폼 시트의 닫기·지우기 연결                  |
| `useStoredValue(def, scopeId?)`                                 | `shared/storage`                      | `[value, setValue]`                                                                                                      | 저장 값마다 만든 repository                                                |
| `useMyAccountId({ isEnabled })`                                 | `features/identity/user/hooks`        | `string \| null`(꺼지면 캐시가 있어도 `null`)                                                                            | id만 쓰는 `me` 직접 조회                                                   |
| `useSuspenseMyAccountId()`                                      | `features/identity/user/hooks`        | `string`(경계 안, `select`로 id만 골라 다른 칸이 바뀌어도 다시 그리지 않는다)                                            | id만 쓰는 `useSuspenseQuery(useGetMeQueryOptions())`                       |
| `usePushPermissionAction({ source })`                           | `features/notification/hooks`         | `{ runStep(step), isPending }`                                                                                           | 권한 요청·추적                                                             |
| `useVoiceCaptureReadiness({ feature, surface, mode })`          | `features/voice/hooks`                | `({ locale, entry, onSubscribe }) => Promise<{ isReady }>`(한도 → 동의 → 마이크, 답을 기다리는 사이 내려가면 준비 안 됨) | `useStartVoiceNote`·`useAddTodoQuickVoice` 복제                            |
| `useWhatsNewCampaign()`                                         | `features/app-config/whats-new/hooks` | `{ config, isConfigLoading, release, identity, hasSeen }`                                                                | 3개 훅의 같은 조회                                                         |

있는 도구도 같은 일에는 하나만 쓴다.

| 훅                                                   | 자리                                            | 모양                                                       | 쓰는 때                                                                                                                        |
| ---------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `useRouteParams(schema)`                             | `shared/hooks/use-route-params.ts`              | `[params, setParams]`                                      | URL 값 여럿                                                                                                                    |
| `useRouteParamsOrRedirect(schema, { fallbackHref })` | `shared/hooks/use-route-params-or-redirect.tsx` | `{ params, redirect: null } \| { params: null, redirect }` | route 파일의 params 검증                                                                                                       |
| `useView(key, schema)`                               | `shared/hooks/use-view.ts`                      | `[view, setView]`                                          | 탭·보기 URL 값 하나                                                                                                            |
| `useStepper(options)`                                | `shared/hooks/use-stepper.tsx`                  | `Stepper`                                                  | 단계 흐름(아래)                                                                                                                |
| `useRefresh(refetch)`                                | `shared/hooks/use-refresh.ts`                   | `[isRefreshing, handleRefresh]`                            | 당겨서 새로고침 표시                                                                                                           |
| `useSingleTap(onTap)`                                | `shared/hooks/use-single-tap.ts`                | 같은 인자의 함수                                           | 연타로 화면이 두 번 쌓이는 것 막기, 닫히는 폼의 같은 프레임 저장 연타 막기(`handleSavePress`, [forms](./forms.md#버튼과-제출)) |
| `useConfirmDialog()`                                 | `shared/ui/confirm-dialog`                      | `{ openAsync(options) }` → `Promise<boolean>`              | 확인 다이얼로그                                                                                                                |
| `useFetchNextPage(…)`                                | `shared/ui/infinite-list`                       | 다음 페이지 요청                                           | `InfiniteList`의 끝 도달                                                                                                       |

애니메이션 멈춤 조건 `useIsAnimationActive()`(꾸밈 `withRepeat`·프레임 콜백은 모두 이것으로 멈춘다)와 UI 부품이 주는 훅은 [ui](./ui.md)·[ui-catalog](./ui-catalog.md)에 있다.

## 만들지 않는 것

| 만들지 않는 훅                                                           | 대신 쓰는 것                                                                        |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `useConfirm`                                                             | `useConfirmDialog().openAsync`                                                      |
| `useShare`                                                               | DI 훅 `useSystemShare()`. 진행 상태가 필요하면 `useMutation`으로 감싼다             |
| `useInfiniteListQuery`                                                   | `InfiniteList` + `useFetchNextPage`                                                 |
| 라이브러리 훅을 감싸기만 하는 훅(`useMemos = () => useSuspenseQuery(…)`) | 컴포넌트에서 `useSuspenseQuery(useGetXQueryOptions())`·`useForm`·`useMutation` 직접 |
| 폼 값을 잇기만 하는 훅(`useMemoForm`, `useImportRange(form)`)            | 화면의 `Controller`·`Watch`·`FormState`([forms](./forms.md))                        |
| 화면 동작을 모은 훅(`useEditor`, `useActions`)                           | 책임마다 훅 하나                                                                    |
| 진행 상태를 직접 든 비동기 훅                                            | `useMutation`                                                                       |

## useStepper

단계 흐름(가입, 비밀번호 찾기·바꾸기, 캘린더 가져오기, 결제, 새 기능 소개)은 `useStepper` 하나다. 인터페이스는 Toss `@use-funnel`의 `useFunnel`과 같아 그 문서의 사용법이 그대로 통한다.

```tsx
// 목표 모양: 화면이 stepper와 폼을 갖고 단계와 전환을 나열한다
type SignUpStepContexts = {
  name: Record<string, never>;
  email: Record<string, never>;
  // … password, passwordConfirm
  verification: { email: string };
};

const stepper = useStepper<SignUpStepContexts>({
  id: 'sign-up',
  initial: { step: 'name' },
  onStepChange: ({ step }) => trackEvent('auth_signup_step_viewed', { step }),
});

return (
  <stepper.Render
    name={() => <NameStep form={form} onNext={() => stepper.history.push('email')} />}
    // …
    verification={({ context }) => (
      <VerificationStep email={context.email} onBack={() => stepper.history.backTo('email')} />
    )}
  />
);
```

- **화면이 갖는다.** route 파일의 화면 컴포넌트가 `useStepper`와 단계에 걸친 폼을 갖고 `<stepper.Render>`에 단계와 전환을 나열한다. 두 route가 함께 쓰는 흐름은 그 조립 컴포넌트(`bootstrap/navigation/subscription-checkout.tsx`)가, 새 기능 소개는 route가 고른 릴리스 컴포넌트(`Release1170Steps`)가 갖는다.
- **단계 화면은 지역 컴포넌트다.** 같은 파일 아래에 두고 `stepper`를 받지 않는다. 전환 콜백만 받고 이름은 `onNext`(다음 단계), `onDone`(흐름 끝)과 결과를 말하는 이름(`onGranted`·`onStarted`)이다. 단계 사이 진행 점·제목 줄도 JSX 상수가 아니라 지역 컴포넌트다.
- 반환은 `{ step, context, index, historySteps, history: { push, replace, back, go, backTo }, Render }`다. 단계와 context는 `{ [단계]: context }` 타입 하나로 정하고, `Render`가 단계를 하나라도 빠뜨리면 컴파일 오류다.
- context가 빈 단계는 `Record<string, never>` 하나로 적고 context 인자를 생략한다(`initial: { step }`, `history.push('email')`). `object`·`context: {}`를 쓰지 않는다. `push`·`replace`는 값이나 updater `(prev) => next`를 받고, `prev`는 부른 순간의 지금 단계 context다.
- 기록에 있는 이름 있는 단계로 돌아갈 때는 `history.backTo(step)`이다. `historySteps`로 위치를 찾아 `go(delta)`를 직접 계산하지 않는다.
- 단계 추적은 `onStepChange` 하나다(`auth_signup_step_viewed`, `todo_import_step_viewed`). 단계 컴포넌트에서 따로 추적하지 않는다.
- 단계 안에 `useState`로 또 단계를 두지 않는다. 화면이 바뀌는 입력 묶음은 모두 진짜 단계여서 Android 뒤로 가기가 단계마다 한 칸씩 돈다.
- 칸이 하나씩 늘어나는 입력(가입의 이름 → 이메일, 새 비밀번호 → 확인)은 이웃 단계에 같은 렌더러 함수를 넘긴다. 같은 렌더러로 이어진 단계는 한 화면이라 다시 마운트되지 않아 입력 포커스와 키보드가 남는다. 렌더러가 다르면 단계마다 새로 마운트된다. 같은 렌더러로 이어진 단계는 autoFocus가 다시 돌지 않아, 뒤로 와도 키보드가 남게 `useFocusOnStepBack`이 앞 칸에 포커스를 준다.
- `<stepper.Render … />` JSX로만 그린다(`aido/no-render-call`). 렌더러는 단계 컴포넌트를 돌려주기만 하고 훅은 단계 컴포넌트 안에서 쓴다.
- 단계는 URL로 복원하지 않는다. 탭 Stack 화면의 단계 흐름(캘린더 일정 가져오기)은 둘째 단계부터 헤더 왼쪽 버튼이 `history.back`이다. 휴대폰은 `usePreventRemove`로 헤더·밀어서 뒤로 가기의 한 칸 pop을 앞 단계로 바꾸고, 넓은 화면은 메뉴 이동을 막지 않게 밀어서 닫기만 끈다.

| 흐름            | 단계(같은 렌더러로 이은 단계는 괄호)                                   |
| --------------- | ---------------------------------------------------------------------- |
| 가입            | (`name` → `email`) → (`password` → `passwordConfirm`) → `verification` |
| 비밀번호 찾기   | `email` → `verificationCode` → (`newPassword` → `newPasswordConfirm`)  |
| 비밀번호 바꾸기 | `currentPassword` → (`newPassword` → `newPasswordConfirm`)             |
| 캘린더 가져오기 | `permission` → `calendars` → `categories` → `options`                  |

라이브러리를 쓰지 않는 이유: `@use-funnel/react-navigation-native`는 Expo Router와 이어지지 않는 navigation 사본을 만들고 단계를 route params에 저장해 단계마다 폼이 다시 마운트된다. `@use-funnel/core`의 `createUseFunnel(router)`는 Android 뒤로 가기 연결과 같은 단계 연속 push 건너뛰기·`onStepChange` 추적을 다시 써야 하고 0.1.0이라 계약이 바뀔 위험이 있다.

## 좋은 훅인지 판단하는 질문

1. 이 훅이 바뀌는 이유를 한 문장으로 말할 수 있는가?
2. 상태·effect·구독 중 하나라도 묶는가? 아니면 순수 함수·Policy·컴포넌트 안 코드로 충분한가?
3. 같은 일을 하는 공용 훅이나 라이브러리 기능(TanStack Query, RHF, Expo Router)이 이미 있는가?
4. 반환이 위 표의 모양 중 하나인가? 상태라면 튜플인가? 멈추면 이름이 `useSuspense{X}`인가?
5. 인자가 객체 하나이고 위치 불리언이 없는가? 이름만 보고 반환을 짐작할 수 있는가?
6. 건 구독·타이머와 await 뒤 처리를 정리하는가?
7. 한 곳만 쓰면 그 파일 안에 있는가? 파일 이름이 export와 같은가?
