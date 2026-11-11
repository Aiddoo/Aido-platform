# 훅

한 훅은 한 책임이고, 같은 일은 공용 훅 하나로 한다. params 튜플 훅과 상태 원천은 [state-and-routing](./state-and-routing.md), 쿼리·mutation 옵션 훅은 [data](./data.md)에 있다. 아직 이 모양이 아닌 훅은 [migration-status](./migration-status.md)에 있다.

## 규칙

**만들 때**

- 훅은 상태·effect·구독을 묶거나 여러 곳이 같은 규칙을 공유할 때만 만든다. 한두 줄을 감싸거나 파일을 짧게 하려는 훅은 만들지 않는다.
- 바뀌는 이유가 하나다(route 값 하나, 구독 하나, 전환 조정, 칸 포커스). 계산은 순수 함수·Policy로 빼고 훅은 부르기만 한다.
- 포괄 훅(`useEditor`, `useActions`, 화면 동작 전부를 묶은 훅)을 만들지 않는다. 책임이 둘이면 훅도 둘이다(`useMemoForm` + `useMemoSave`).
- `useForm`·`useSuspenseQuery`·`useMutation`은 쓰는 컴포넌트에서 직접 부른다. 라이브러리 훅을 역할 없이 감싸지 않는다(`useMemos = () => useSuspenseQuery(…)`). 감싸는 훅은 규칙을 더할 때만 만든다(두 번 탭 방지, 화면 포커스와 묶기, 추적 한 곳).
- 진행·오류 상태를 `useState`로 만들지 않는다. 비동기 동작은 `useMutation`의 `isPending`·`error`를 쓴다.

**반환**

| 훅                       | 반환                   | 예                                                                                |
| ------------------------ | ---------------------- | --------------------------------------------------------------------------------- |
| 상태·route 값            | 튜플. 읽기 전용도 튜플 | `[view, setView]`, `[{ goalAmount, monthlyAmount }, setSavingParams]`, `[todoId]` |
| 저장소 없는 계산·구독 값 | 값                     | `useIsOnline()` → `boolean`, `useNow()` → `Instant`                               |
| 동작 하나                | 함수                   | `useGoBack()` → `() => void`                                                      |
| 동작 묶음                | 이름 있는 객체         | `usePushPermissionAction()` → `{ runStep, isPending }`                            |
| 세 갈래 이상 상태        | 유니온 값 하나         | `usePushOnboardingGuardState()` → `'open' \| 'closed' \| 'pending'`               |

- 튜플이면 저장소(URL·저장 값·`useState`)를 바꿔도 훅 반환만 고친다. 이름은 값을 드러내고(`[selectedMemoId, setSelectedMemoId]`), 쓰지 않는 요소는 `_`를 붙인다.
- 반대 뜻 불리언 훅 두 개(`useIsXOpen`·`useIsXClosed`)를 만들지 않는다.

**인자와 타입**

- 옵션은 이름 있는 객체 하나다(`useAndroidBackHandler({ isEnabled, onBack })`). 위치 불리언을 쓰지 않는다. 인증 상태는 `{ authStatus }`로 받는다.
- 인자·props 타입에 `ReturnType<typeof useX>`를 쓰지 않고 이름 있는 interface를 둔다. 훅 안이 바뀌어도 받는 쪽 타입이 흔들리지 않는다.

**파일과 위치**

- 파일 이름은 export의 kebab-case다(`usePushPermissionAction` → `use-push-permission-action.ts`). 공개 훅 하나에 파일 하나이고, 훅이 아닌 export(순수 함수, 상수, 로그 키)는 `utils/`·`constants/`에 둔다.
- 여러 파일이 쓰면 `hooks/`, 한 파일만 쓰면 그 파일 아래 지역 훅이다. 지역 훅도 한 책임이다.
- `app/`·`bootstrap/`이 쓰는 기능 훅은 기능의 공개 면이라 한 곳만 써도 `hooks/`에 둔다.
- 제품 말 없이 설명되고 두 기능 이상이 쓰면 `shared/`다([structure](./structure.md)).

**effect**

- effect 안에서 최신 콜백은 `useEffectEvent`로 읽는다. deps에 넣어 구독·타이머를 다시 걸지 않는다.
- 구독·타이머·await 뒤 처리는 [data의 메모리와 수명](./data.md#메모리와-수명)을 따른다. `AppState`·`BackHandler`를 직접 듣지 않고 `useOnAppForeground`·`useAndroidBackHandler`를 쓴다.

## 공용 훅

새로 만들기 전에 이 표를 본다. 같은 일을 하는 훅이 있으면 그것을 쓰고, 모양이 맞지 않으면 그 훅을 고친다.

| 훅                                                     | 자리                                  | 모양                                                                                                                     | 없애는 복제                                               |
| ------------------------------------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| `useGoBack({ fallbackHref })`                          | `shared/hooks`                        | `() => void`(두 번 탭 방지)                                                                                              | `canGoBack ? back : replace` 8곳                          |
| `useAndroidBackHandler({ isEnabled, onBack })`         | `shared/hooks`                        | `void`(`useEffectEvent`, 화면 포커스와 묶음)                                                                             | BackHandler 5곳                                           |
| `useOnAppForeground(onForeground)`                     | `shared/hooks`                        | `void`(AppLifecycle 포트)                                                                                                | 4곳                                                       |
| `useAppLifecycleState()`                               | `shared/hooks`                        | `AppLifecycleState`(AppLifecycle 포트 구독 하나)                                                                         | `useSyncExternalStore(appLifecycle…)` 3곳                 |
| `useNow({ tickMs, until })`                            | `shared/hooks`                        | `Instant`                                                                                                                | 지금 시계 4곳                                             |
| `useMinuteNow()`                                       | `shared/hooks`                        | `Instant`(앱 하나의 분 시계 구독, 상대 시간·날짜 판단)                                                                   | 행마다 거는 분 타이머                                     |
| `useLocaleContext()`                                   | `shared/hooks`                        | 앱 언어 + `APP_LOCALES` 항목                                                                                             | 언어 매핑 약 15곳                                         |
| `useCopyToClipboard()`                                 | `shared/hooks`                        | `{ copy(text, { successMessage, failureMessage }) }`                                                                     | 2곳(`useCopiedFeedback`은 아이콘 타이머라 따로 둔다)      |
| `useEnsurePermission({ get, request, copy })`          | `shared/hooks`                        | `() => Promise<boolean>`                                                                                                 | 마이크·위치 권한 흐름                                     |
| `useLayoutSize()`                                      | `shared/hooks`                        | `[size \| null, onLayout]`(재기 전 `null`, 첫 프레임은 `size?.width ?? 어림값`)                                          | `onLayout` → `setSize` 직접 구현                          |
| `useOpenSheet()`                                       | `shared/ui/overlay`                   | `openSheet(render, options)` → `Promise<T \| undefined>`(취소·끌어 내림은 `undefined`)                                   | overlay + `ModalBottomSheet` 직접 연결                    |
| `useOpenKeyboardSheet()`                               | `shared/ui/overlay`                   | `openKeyboardSheet(({ isOpen, onOpenChange, close }) => …)`                                                              | `KeyboardBottomSheet`를 그리는 폼 시트의 닫기·지우기 연결 |
| `useStoredValue(def, scopeId?)`                        | `shared/storage`                      | `[value, setValue]`                                                                                                      | repository 11개                                           |
| `useMyAccountId({ isEnabled })`                        | `features/identity/user/hooks`        | `string \| null`(꺼지면 캐시가 있어도 `null`)                                                                            | id만 쓰는 `me` 직접 조회 12곳                             |
| `useSuspenseMyAccountId()`                             | `features/identity/user/hooks`        | `string`(경계 안, `select`로 id만 골라 다른 칸이 바뀌어도 다시 그리지 않는다)                                            | id만 쓰는 `useSuspenseQuery(useGetMeQueryOptions())`      |
| `usePushPermissionAction({ source })`                  | `features/notification/hooks`         | `{ runStep(step), isPending }`                                                                                           | 권한 요청·추적 6곳                                        |
| `useVoiceCaptureReadiness({ feature, surface, mode })` | `features/voice/hooks`                | `({ locale, entry, onSubscribe }) => Promise<{ isReady }>`(한도 → 동의 → 마이크, 답을 기다리는 사이 내려가면 준비 안 됨) | `useStartVoiceNote`·`useAddTodoQuickVoice` 복제           |
| `useWhatsNewCampaign()`                                | `features/app-config/whats-new/hooks` | `{ config, isConfigLoading, release, identity, hasSeen }`                                                                | 3개 훅의 같은 조회                                        |

있는 도구도 같은 일에는 하나만 쓴다.

| 훅                                                   | 자리                                            | 모양                                                       | 쓰는 때                            |
| ---------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------- | ---------------------------------- |
| `useRouteParams(schema)`                             | `shared/hooks/use-route-params.ts`              | `[params, setParams]`                                      | URL 값 여럿                        |
| `useRouteParamsOrRedirect(schema, { fallbackHref })` | `shared/hooks/use-route-params-or-redirect.tsx` | `{ params, redirect: null } \| { params: null, redirect }` | route 파일의 params 검증           |
| `useView(key, schema)`                               | `shared/hooks/use-view.ts`                      | `[view, setView]`                                          | 탭·보기 URL 값 하나                |
| `useStepper(options)`                                | `shared/hooks/use-stepper.tsx`                  | `Stepper`                                                  | 단계 흐름(아래)                    |
| `useRefresh(refetch)`                                | `shared/hooks/use-refresh.ts`                   | `[isRefreshing, handleRefresh]`                            | 당겨서 새로고침 표시               |
| `useSingleTap(onTap)`                                | `shared/hooks/use-single-tap.ts`                | 같은 인자의 함수                                           | 연타로 화면이 두 번 쌓이는 것 막기 |
| `useConfirmDialog()`                                 | `shared/ui/confirm-dialog`                      | `{ openAsync(options) }` → `Promise<boolean>`              | 확인 다이얼로그                    |
| `useFetchNextPage(…)`                                | `shared/ui/infinite-list`                       | 다음 페이지 요청                                           | `InfiniteList`의 끝 도달           |

애니메이션 멈춤 조건 `useIsAnimationActive()`(꾸밈 `withRepeat`·프레임 콜백은 모두 이것으로 멈춘다)와 UI 부품이 주는 훅은 [ui](./ui.md)·[ui-catalog](./ui-catalog.md)에 있다.

## 만들지 않는 것

| 만들지 않는 훅                                                           | 대신 쓰는 것                                                                        |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `useConfirm`                                                             | `useConfirmDialog().openAsync`                                                      |
| `useShare`                                                               | DI 훅 `useSystemShare()`. 진행 상태가 필요하면 `useMutation`으로 감싼다             |
| `useInfiniteListQuery`                                                   | `InfiniteList` + `useFetchNextPage`                                                 |
| 라이브러리 훅을 감싸기만 하는 훅(`useMemos = () => useSuspenseQuery(…)`) | 컴포넌트에서 `useSuspenseQuery(useGetXQueryOptions())`·`useForm`·`useMutation` 직접 |
| 화면 동작을 모은 훅(`useEditor`, `useActions`)                           | 책임마다 훅 하나                                                                    |
| 진행 상태를 직접 든 비동기 훅                                            | `useMutation`                                                                       |

## useStepper

단계 흐름(가입, 비밀번호 찾기·바꾸기, 새 기능 소개)은 `useStepper` 하나다. 인터페이스는 Toss `@use-funnel`의 `useFunnel`과 같아 그 문서의 사용법이 그대로 통한다.

```tsx
const stepper = useStepper<SignUpStepContexts>({
  id: 'sign-up',
  initial: { step: 'name' },
  onStepChange: ({ step }) => trackEvent('auth_signup_step_viewed', { step }),
});

stepper.history.push('password');
stepper.history.replace('verification', { email });
stepper.history.replace('verification', (prev) => ({ ...prev, email: nextEmail }));
```

- 반환은 `{ step, context, index, historySteps, history: { push, replace, back, go }, Render }`다. 단계와 context는 `{ [단계]: context }` 타입 하나로 정하고, `Render`가 단계를 하나라도 빠뜨리면 컴파일 오류다.
- context가 빈 단계(`Record<string, never>`)는 context 인자를 생략한다. `push`·`replace`는 값이나 updater `(prev) => next`를 받고, `prev`는 부른 순간의 지금 단계 context다.
- 단계 추적은 `onStepChange` 하나다(`auth_signup_step_viewed`, `auth_password_reset_step_viewed`). 단계 컴포넌트에서 따로 추적하지 않는다.
- 단계 안에 `useState`로 또 단계를 두지 않는다. 화면이 바뀌는 입력 묶음은 모두 진짜 단계여서 Android 뒤로 가기가 단계마다 한 칸씩 돈다.
- 칸이 하나씩 늘어나는 입력(가입의 이름 → 이메일, 새 비밀번호 → 확인)은 이웃 단계에 같은 렌더러 함수를 넘긴다. 같은 렌더러로 이어진 단계는 한 화면이라 다시 마운트되지 않아 입력 포커스와 키보드가 남는다. 렌더러가 다르면 단계마다 새로 마운트된다.
- `<stepper.Render … />` JSX로만 그린다. 렌더러는 단계 컴포넌트를 돌려주기만 하고 훅은 단계 컴포넌트 안에서 쓴다. 폼은 흐름 컴포넌트가 소유해 앞 단계로 돌아가도 값이 남는다.
- 단계는 URL로 복원하지 않는다. 네이티브 헤더 제목·툴바가 단계를 따르면 스크린이 `useStepper`를 갖고 폼에 `stepper`를 넘긴다(`app/(auth)/sign-up.tsx`).
- 같은 렌더러로 이어진 단계는 autoFocus가 다시 돌지 않는다. 뒤로 와도 키보드가 남게 `useFocusOnStepBack`이 앞 칸에 포커스를 준다.

| 흐름            | 단계(같은 렌더러로 이은 단계는 괄호)                                   |
| --------------- | ---------------------------------------------------------------------- |
| 가입            | (`name` → `email`) → (`password` → `passwordConfirm`) → `verification` |
| 비밀번호 찾기   | `email` → `verificationCode` → (`newPassword` → `newPasswordConfirm`)  |
| 비밀번호 바꾸기 | `currentPassword` → (`newPassword` → `newPasswordConfirm`)             |

`@use-funnel/react-navigation-native`는 쓰지 않는다. Expo Router와 맞지 않기 때문이다.

- 별도 navigation 사본을 만들어 Expo Router의 스택과 이어지지 않는다.
- 단계를 route params에 저장해 입력 단계를 URL로 복원하지 않는 규칙과 부딪힌다.
- 단계마다 화면이 새로 마운트돼 폼도 다시 마운트된다.

`@use-funnel/core@0.1.0`의 `createUseFunnel(router)`로 Expo Router용 router를 직접 붙이는 길도 검토했다. 쓰지 않는 이유는 다음과 같다.

- Android 뒤로 가기가 단계마다 한 칸씩 돌아야 하는데 그 연결을 우리가 다시 써야 한다.
- 같은 단계를 연속으로 push하면 건너뛰는 규칙과 `onStepChange` 추적이 우리 훅에 이미 있다.
- 의존성이 하나 더 늘고, 0.1.0이라 계약이 바뀔 위험이 있다.

## 좋은 훅인지 판단하는 질문

1. 이 훅이 바뀌는 이유를 한 문장으로 말할 수 있는가?
2. 상태·effect·구독 중 하나라도 묶는가? 아니면 순수 함수·Policy·컴포넌트 안 코드로 충분한가?
3. 같은 일을 하는 공용 훅이나 라이브러리 기능(TanStack Query, RHF, Expo Router)이 이미 있는가?
4. 반환이 위 표의 모양 중 하나인가? 상태라면 튜플인가?
5. 인자가 객체 하나이고 위치 불리언이 없는가? 이름만 보고 반환을 짐작할 수 있는가?
6. 건 구독·타이머와 await 뒤 처리를 정리하는가?
7. 한 파일만 쓰면 그 파일 안에 있는가? 파일 이름이 export와 같은가?
