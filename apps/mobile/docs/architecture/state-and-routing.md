# 상태와 라우팅

값마다 원천을 하나로 정하고, URL 값은 튜플 훅으로 읽고 쓰고, 화면 이동은 Expo Router 권장 방식으로 한다. 저장 값·쿼리·폼의 상세는 [data](./data.md), 공용 훅은 [hooks](./hooks.md), 시트·메뉴 부품은 [ui-catalog](./ui-catalog.md)에 있다.

## 상태 원천

| 상태                                           | 도구                                                                | 판단 기준                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 서버 데이터                                    | TanStack Query `queryOptions`·`mutationOptions`, `useSuspenseQuery` | 서버가 진실이다. 앱이 다시 계산하거나 복사하지 않는다                |
| 기기 비동기 값(OS 권한, 위치, 앱 아이콘)       | TanStack Query, 키 루트 `['device', …]`                             | 비동기로 다시 읽어야 한다. 기능 무효화에 휩쓸리지 않게 루트를 나눈다 |
| URL 보기 상태(선택 항목, 탭, 날짜, 친구, 필터) | params 튜플(`useView`, `useRouteParams`)                            | 딥링크·뒤로 가기로 복원돼야 한다. `useState` 사본을 두지 않는다      |
| 기기 저장 값(설정, 안내를 본 기록)             | `defineStoredValue` + `useStoredValue`                              | 앱을 다시 켜도 남아야 한다. 키·파서는 정의 밖에 두지 않는다          |
| 작성 중 초안                                   | `shared/draft`(암호화 저장소, 사용자 범위)                          | 긴 본문을 URL·Query 캐시에 넣지 않는다                               |
| 폼 값                                          | react-hook-form + `zodResolver`                                     | 폼 안에서만 쓴다. 전역 상태에 복사하지 않는다                        |
| 메모리 상태 기계(알림 진입, 인증 세션)         | `stores/{name}.store.ts` + `useSyncExternalStore`                   | React 밖 이벤트와 여러 화면이 함께 읽는다                            |
| 잠깐 쓰는 UI 값(열림, 측정값)                  | `useState`·`useReducer`                                             | 나머지 전부                                                          |

- 원천은 하나다. 같은 값을 두 저장소에 복사하지 않고, 계산할 수 있는 값은 상태로 두지 않는다.
- 앱이 만드는 Context는 DI와 UI 내부 구현(시트, 폼, 레이아웃 측정)에만 쓴다. 나머지는 props → 컴포넌트 prop → Query 캐시 → route 훅 → 외부 저장소 순서로 고른다.
  - route 상태를 감싼 Context·store는 두지 않는다. 예외는 마이 메뉴 칸의 `MyPageMenuNavigationProvider` 하나다. 경로 원천은 router이고, 이 Context는 메뉴 칸의 행(`MyPageMenuItem` 15개와 프로필·새 기능·초대 줄)이 함께 쓰는 이동(연타 가드 하나, 넓은 화면의 상세 걷기)과 경로를 칸에서 한 번 받아 선택이 바뀐 행만 다시 그리게 하는 store(`createEventChannel`)를 내린다. 넓은 화면에서 상세 칸이 깊어질 때마다 메뉴 행이 모두 다시 그려지지 않게 하는 것이 이유이고 `use-my-page-menu-navigation.test.tsx`가 지킨다.

라이브러리가 주는 상태를 다시 만들지 않고, 그 훅을 한 번 더 감싸지도 않는다.

| 필요한 것         | 쓰는 것                                                                                             | 만들지 않는 것                                           |
| ----------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 저장 중·저장 실패 | `mutation.isPending`, `error`, `variables`                                                          | `useState` 진행·오류 상태                                |
| 조회 중·조회 실패 | Suspense + 경계, `isError`, `refetch`                                                               | 직접 만든 로딩 상태                                      |
| 무한 목록         | `hasNextPage`, `isFetchingNextPage`, `isFetchNextPageError`, `fetchNextPage`                        | 페이지 번호 상태                                         |
| 제출·유효성       | `formState.isSubmitting`, `isValid`, `errors`. 단계 폼은 칸별 `getFieldState`의 `isDirty`·`invalid` | 폼 값 복사, 같은 규칙의 별도 함수                        |
| 진행 중인 변경    | `useIsMutating`, `useMutationState`                                                                 | 전역 플래그                                              |
| 값 구독           | `useWatch`, `useStoredValue`                                                                        | 렌더 경로 `getValues()`, 저장 값의 Query·`useState` 사본 |
| 당겨서 새로고침   | `useRefresh(() => refresh{Feature}(queryClient))`                                                   | `isRefetching`(배경 재조회까지 켜진다)                   |

정해 둔 예외는 다음뿐이다.

- 초대 수락 결과는 다음 화면에 `queryFn: skipToken` 쿼리로 넘긴다(`useGetRedemptionResultQueryOptions`). 보상·친구 결과를 URL로 넘기면 딥링크로 위조할 수 있다.
- 차단·신고 확인 문구의 이름은 route query(`name`)로 받는다. 표시용이고 판정은 경로의 id로만 한다.
- 가입·비밀번호 재설정 단계는 URL로 복원되면 안 돼 `useStepper`가 갖는다([hooks](./hooks.md)). 친구 검색어는 입력 중인 값이라 지역 상태다.

## params 튜플

```ts
const [view, setView] = useView('view', invitedFriendsViewSchema); // 값 하나
const [{ year, week }] = useRouteParams(achievementParamsSchema); // 여러 값(한 파일만 읽으면 그 자리에서)
const [todoId] = useTodoId(); // 읽기 전용도 튜플
```

- 공용 `useRouteParams(schema)`(`shared/hooks/use-route-params.ts`)와 `useView(key, schema)`(`shared/hooks/use-view.ts`)가 `expo-router`의 `useLocalSearchParams`·`router.setParams`를 감싼다. 반환이 nuqs 같은 튜플이라 원천을 `useState`나 저장 값으로 바꿔도 훅 반환만 고친다.
- 값 하나는 `[value, setValue]`, 여러 값은 `[{ a, b }, setValues]`, 읽기 전용은 `[value]`다. 이름은 값을 드러낸다(`[selectedMemoId, setSelectedMemoId]`). 쓰지 않는 요소는 `_`를 붙인다.
- 스키마는 `schemas/{name}-params.schema.ts`의 `{name}ParamsSchema`, 탭·보기 값은 `{name}ViewSchema`다. 훅 파일에 `z.object`를 두지 않는다.
- 쓰는 필드는 URL 문자열과 값을 오가는 `z.codec`이다(`routeIdSchema`). `.transform`은 `z.encode`에서 터지고 `z.coerce`는 숫자로 남아 조용히 지워지므로 읽기 전용 필드에만 쓴다. 없거나 잘못된 값의 기본값은 `.catch`다.
- 값을 지우면 `undefined`를 넘긴다. boolean은 끌 때 `undefined`라 `?isEditing=false`가 남지 않는다.
- 한 파일만 읽으면 그 자리에서 `useRouteParams`·`useView`를 부른다. 여러 파일이 읽으면 `hooks/use-{name}-params.ts`의 이름 있는 훅 하나로 뺀다. 탭은 `ViewTabs`에 `schema`·`value`·`onValueChange`로 넘긴다.
- **검증은 route 파일이 한다.** `useRouteParamsOrRedirect(schema, { fallbackHref })`가 틀린 주소를 `<Redirect>`로 돌려주고 route는 그것만 그린다. route는 `params`를 읽지 않고, 안쪽 화면(같은 파일의 지역 컴포넌트)이 같은 스키마의 튜플 훅으로 좁혀진 값을 읽어 `resetKeys`·`key`도 정한다. 리다이렉트를 직접 만들지 않는다.

```tsx
export default function MemoDetailRoute() {
  const route = useRouteParamsOrRedirect(memoParamsSchema, { fallbackHref: '/memo' });

  if (route.redirect != null) {
    return route.redirect;
  }

  return <MemoDetailScreen />;
}
```

- **원시 `setParams`를 내보내지 않는다.** 연관 값을 지우는 세터를 이름 있게 내보낸다(`useTodoCommentSort`는 `comment`를 함께 지운다). 호출부가 지우기를 잊을 수 없다. `router.setParams`와 `useRouteParams`의 원시 setter는 params 훅(`hooks/use-*-params.ts`) 밖에서 쓰지 않는다(`no-restricted-properties`, `aido/route-setter-location`). 예외는 칸 크기로 이동 방식을 고르는 `useFeedSelectedTodoId` 하나다.
- **목록 행은 route 훅을 부르지 않는다.** 부모가 한 번 읽어 `isSelected`를 넘긴다. 가상 목록이 행 수만큼 URL을 파싱하지 않게 한다. 짧은 고정 목록은 행이 읽어도 된다.
- **레이아웃은 자식 params를 구독하지 않는다.** 레이아웃은 내비게이터와 Provider만 둔다. 루트에서 URL을 봐야 하는 훅은 `null`을 그리는 형제 컴포넌트에 둔다: `AuthGateLayout`의 `RouteWatchers`(`useScreenTracking`, `useWidgetAppEntry`, `useAppEntrySegmentSync`)와 `NotificationProvider`의 `ForegroundPushPresentation`. 스플래시 판단이 쓰는 "앱 입구인가"는 `useAppEntrySegmentSync`가 푸시 진입 슬롯에 적고 레이아웃은 슬롯만 읽는다. 내 정보·창 크기를 구독하는 루트 훅도 같은 이유로 `WindowWatchers`(`useOrientationLock`)·`SessionWatchers`(`useSyncUserIdentity`, `useClaimDeviceDataForUser`)·`AppEntryWatchers`(`useInstallReferrerCapture`, `usePushNotificationResponse`)에, 앱 화면 묶음 레이아웃의 할 일 이벤트 훅은 `TodoEventWatchers`(`useRecordTodoCreated`, `useRecordTodoCompletion`, `useOfferMarketingPushAfterCompletion`)에 둔다. `setParams`·내 정보 변경·창 크기 변경이 레이아웃을 다시 그리지 않는 것은 `auth-gate-layout.test.tsx`가 지킨다.
- 화면 훅에서 `useGlobalSearchParams`를 쓰지 않는다. 보이지 않는 화면도 URL이 바뀔 때마다 다시 그려진다. 현재 화면과 무관하게 읽어야 하는 위의 `null` 자식만 쓴다.

| 스키마                     | 훅 → 반환                                                                                                                                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `feedParamsSchema`         | `useFeedDateKey` → `[dateKey, setDateKey]`, `useFeedFriendId` → `[friendId, setFriendId]`, `useFeedAction`, `useFeedSelectedTodoId`                                                                  |
| `friendListParamsSchema`   | `useFriendListView` → `[view, setView]`, `useFriendListIsEditing` → `[isEditing, setIsEditing]`(파일 하나)                                                                                           |
| `friendParamsSchema`       | 친구 피드의 `useRouteFriend()`가 안의 `useRouteFriendId` → `[friendId]`로 찾음·읽는 중·실패·친구 아님 유니온을 준다                                                                                  |
| `invitedFriendsViewSchema` | `useInvitedFriendsView` → `[view, setView]`                                                                                                                                                          |
| 그 밖                      | `useTodoSheetDateKey`·`useTodoCategoryId`·`useNudgeId`·`useVoiceNoteDraftId` → `[id]`, `useCheckoutRoute` → `[pathname, leaveTo]`, `useStartVoiceNoteRequest` → `[isRequested, clearStartVoiceNote]` |

- 계산 값은 튜플이 아니다(`useDateFormatContext`는 값을 돌려준다). 저장소가 없는 구독 값(`useIsOnline`)과 동작 묶음도 튜플이 아니다.

## 라우팅

Expo Router 권장 방식을 따른다. 라우터 교체는 route 전체를 바꾸는 일이라 포트로 숨기지 않는다.

### 경로와 이동

- `app/`에는 route 파일만 둔다. route 화면 테스트는 `src/features/{feature}/__tests__/{route}-screen.test.tsx`다.
- 리소스는 폴더 route다. 세그먼트는 kebab-case, 동적 세그먼트는 `[{entity}Id]`다(`/todo/[todoId]`). `[id]`는 쓰지 않는다.
- 같은 화면의 보기 상태는 camelCase query param이다(`/feed?friendId=…&date=…`, `/memo?memoId=…`). 피드는 `/feed` 한 화면이고 친구 전환은 세터라 pane이 다시 마운트되지 않고 history가 쌓이지 않는다.
- 이동은 호출부에서 typed routes `router.push({ pathname, params })`로 쓴다. 컴파일 때 `pathname`과 동적 세그먼트를 검사하므로 href 래퍼를 만들지 않고 경로 문자열을 잇지 않는다.
- 저장·AI·조회를 기다린 뒤 이동하면 그 사이 떠났는지 먼저 본다. 화면은 `navigation.isFocused()`, 화면 안에서 바뀌는 조각(pane의 메모 편집기)은 마운트 여부도 본다. 떠났으면 지금 보는 화면 위로 끌고 가지 않는다. 메모 AI 정리 결과는 mutation이 초안에 남겨, 그 메모에서 다시 누르면 차감 없이 바로 결과 화면으로 간다.
- 목적지를 계산하는 곳은 하나다. 알림은 `features/notification/utils/notification-destination.view-model.ts`, 위젯은 `findWidgetEntry`(`features/device/widget/utils/widget-navigation-link.view-model.ts`, 명령 유효성은 `WidgetNavigationPolicy`)다.
- 켜진 앱에 앱 밖에서 들어온 이동(누른 푸시, 인증 뒤 여는 위젯 목적지)은 `openEntryHref(href)`(`shared/navigation/open-entry-href.ts`)로 OS가 같은 URL을 연 것처럼 연다. Stack에 그 화면이 있으면 그리로 돌아가고 없으면 쌓는다. `router.navigate`는 탭 위 화면(할 일 상세·시트·결제 모달)에서 탭 화면을 열면 탭 묶음을 하나 더 쌓는다.
- 탭 위 화면이 탭 화면으로 떠날 때는 `router.dismissTo(href)`다. 시트는 `close({ type: 'dismiss-to', href })`, 결제 모달은 `useCheckoutRoute().leaveTo`다. 탭 안과 탭 위에서 함께 도는 코드(오류 화면 문의하기)는 `openEntryHref`다. 탭 화면으로 `push`·`replace`하면 탭 바가 두 겹이 된다.
- 뒤로 가기는 `useGoBack({ fallbackHref })`(돌아갈 화면이 없을 때 화면이 아닌 일을 하면 `{ onFallback }`), Android 뒤로 가기 버튼은 `useAndroidBackHandler`다([hooks](./hooks.md)). `router.canGoBack() ? router.back() : …`을 직접 쓰지 않는다(연타로 두 번 돌아간다).
- 웹 페이지(약관·공지)는 route가 아니라 `useOpenInAppBrowser`로 연다. 앱 자체 WebView는 없고 `aido://webview/…` 링크는 `+not-found`로 간다.
- 공개된 경로와 `aido://` URI는 외부 계약이다. 바꾸지 않고 새 경로는 추가만 한다([compatibility](../../../../docs/conventions/compatibility.md#2-외부-계약-바꾸지-않는다)).

### 내비게이터

- 탭은 `NativeTabs`(`expo-router/native-tabs`)이고 탭마다 `Stack`을 둔다. 헤더는 네이티브 헤더만 쓰고 버튼은 `Stack.Toolbar`로 단다. 피드·메모 탭은 화면과 무관한 왼쪽 날씨 배지를 레이아웃의 `Stack.Screen`에, 화면이 그리는 오른쪽 알림 종(`NotificationBellToolbar`)은 화면에 둔다. 한쪽으로 모으면 레이아웃이 화면 params를 구독하거나 화면이 바뀔 때 배지가 다시 그려진다.
- 탭 그룹은 `(todos)`·`(memos)`·`(me)`이고 여러 탭에서 여는 화면은 shared routes `(me,memos,todos)`에 한 번 둔다. 탭 안에서 연 화면은 누른 탭에 쌓이므로 호출부는 그룹 없는 경로로 연다. 구조, 링크·푸시가 어느 탭에 열리는지, 화면 더하는 법은 [아래](#탭과-함께-쓰는-화면)에 있다.
- 조건이 있는 화면은 `Stack.Protected guard`로 막는다(인증 게이트, 푸시 온보딩, 관리자 화면).
- 메모와 말로 메모(`voice-notes`) 스택은 `slide_from_bottom`이다. `voice-notes`는 녹음을 실수로 잃지 않게 `gestureEnabled: false`다. 시스템 모달은 토스트·한도 안내를 가려 쓰지 않는다.
- `@react-navigation/*`를 직접 import하지 않는다. 테마와 `useHeaderHeight`도 `expo-router`·`expo-router/react-navigation`에서 가져온다.
- 플랫폼 분기는 컴포넌트·스크린의 UI 모양에서만 `process.env.EXPO_OS`로 한다. `Platform.OS`는 lint가 막고, service·model·utils에는 플랫폼 분기를 두지 않는다.

### 탭과 함께 쓰는 화면

탭은 NativeTabs이고 탭마다 Stack 하나다. 여러 탭에서 여는 화면은 Expo Router [shared routes](https://docs.expo.dev/router/advanced/shared-routes/)(배열 그룹)에 한 번 둔다. 모양은 expo-router 스킬의 "Stacks and Tabs Structure"와 같다.

```text
app/(app)/(tabs)/
  _layout.tsx               NativeTabs. 트리거 (todos)·(memos)·(me), anchor (todos)
  (todos)/_layout.tsx       할 일 탭 Stack, anchor feed/index
  (todos)/feed/index.tsx    /feed
  (memos)/_layout.tsx       메모 탭 Stack, anchor memo/index
  (memos)/memo/index.tsx    /memo
  (me)/_layout.tsx          마이 탭 Stack(MyPageStack + 넓은 화면 메뉴 칸), anchor mypage/index
  (me)/mypage/index.tsx     /mypage
  (me,memos,todos)/…        알림함·친구·배지·리포트·설정·새 기능 목록. 세 탭 Stack에 모두 있다
```

- 그룹 이름은 URL에 들어가지 않는다. 그래서 `/friends/invite`·`/settings/…` 같은 공개 경로와 `screen_view` 이름이 1.15.1과 같다. 탭 그룹 이름은 탭의 영어 이름(To-dos·Memos·Me)이다.
- 탭 첫 화면은 그 탭 그룹에만 둔다. 다른 탭에서 `/feed`·`/memo`·`/mypage`로 가면 그 탭으로 바뀐다(친구 목록 → 친구 피드).
- 넓은 화면(iPad·폴더블·Duo 펼침)은 마이 탭에서만 화면마다 왼쪽 메뉴 칸을 둔다([adaptive-pane](../../src/shared/ui/adaptive-pane/adaptive-pane.md#내-정보-메뉴-전체-폭-헤더--화면마다-메뉴-칸)). 할 일·메모 탭에서 연 같은 화면은 메뉴 칸 없이 그 탭 안 전체 폭에 일반 push로 쌓인다.
- 보고 있는 탭을 다시 누르면 iOS NativeTabs가 그 탭 Stack을 첫 화면으로 되돌린다(`disablePopToTop` 기본값, iOS 전용). 탭마다 기록은 따로라 다른 탭에 갔다 오면 쌓아 둔 화면이 그대로다.

**어디에 열리나.** 함께 쓰는 화면은 세 탭에 다 있어 Expo Router가 그룹을 고른다. 앱이 켜져 있고 지금 탭이 있으면 그 탭이다. 탭이 없으면 글자 순 첫 그룹이고, 그게 마이 탭 `(me)`다. 따로 적는 목록이나 경로 바꾸기는 없다.

| 여는 곳                                               | 함께 쓰는 화면(`/notifications`, `/friends/invite`, `/settings/…`) | 한 탭에만 있는 화면                                                                          |
| ----------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| 탭 안에서 누름                                        | 누른 탭 Stack 위. 탭 바가 그대로이고 뒤로 가면 누른 화면이다       | 그 탭으로 바뀐다                                                                             |
| 켜진 앱에 들어온 링크·푸시(웜)                        | 보던 탭 Stack 위. 뒤로 가면 보던 화면이다                          | 그 탭으로 바뀐다                                                                             |
| 꺼진 앱으로 들어온 딥링크·푸시·위젯·초대 링크(콜드)   | 마이 탭. 아래에 내 정보 메뉴가 깔려 뒤로 가면 메뉴다               | 탭 첫 화면은 그 탭. 탭 위 화면(`/todo/[todoId]`·`/memo/[memoId]`)은 아래에 할 일 탭이 깔린다 |
| 탭 위 화면(결제 모달·시트·상세)에서 떠남(`dismissTo`) | 그 화면을 닫고 마이 탭(1.15.1과 같다). 탭 묶음은 한 겹이다         | 그 탭                                                                                        |

- 새 탭 그룹을 더할 때는 `(me)`보다 글자 순으로 앞서지 않는 이름을 쓴다. 앞서면 콜드 링크가 그 탭에 열린다. `src/bootstrap/navigation/tab-stack-routing.test.tsx`가 1.15.1 공개 경로와 함께 쓰는 화면 파일마다 이 표를 확인한다.
- 알림함은 세 탭의 종에서 열어 함께 쓰는 화면이다. 행이 여는 탭 화면은 같은 탭에 쌓이고 뒤로 가면 알림함이다. 넓은 화면의 마이 탭에서는 메뉴 칸 옆 첫 상세로 열려 뒤로 가기 없이 메뉴로 떠난다.
- 탭 위 화면의 되돌리기 fallback(`useGoBack`·`Redirect`의 `/feed`·`/memo`)은 돌아갈 화면이 없을 때만 쓴다. (app)·탭 anchor로 탭 위 화면 아래에는 늘 탭 묶음이 있어 실제로 닿지 않아 그대로 둔다.
- 앱 밖 링크를 다른 탭에 꼭 열어야 하면 보내는 쪽 href에 그룹을 적는다(`/(app)/(tabs)/(todos)/…`, Expo 문서의 "include the group name"). 지금은 그런 화면이 없다.

**함께 쓰는 화면 더하기.** `app/(app)/(tabs)/(me,memos,todos)/` 아래에 route 파일 하나를 만든다. 레이아웃·링크 표·테스트는 고치지 않는다.

- 제목은 화면이 `<Stack.Screen options={{ title: t('…') }} />`로 정한다. 레이아웃에 화면 목록을 두지 않는다. 제목을 정하지 않은 화면은 빈 제목이다. `Stack.Title`은 `headerTitleStyle`을 비워 앱 글꼴 단계·색을 덮으므로 쓰지 않는다.
- 마이 탭 메뉴에서 열 항목이면 `MyPageMenuPane`에 줄을 더한다.
- 한 탭에서만 여는 화면은 그 탭 그룹 폴더(`(todos)`·`(memos)`·`(me)`)에 둔다.

### 앱 밖에서 들어오는 길

푸시가 여는 자리는 [push-notifications](../push-notifications.md), 위젯 URI는 [widgets](../widgets.md), 소셜 로그인은 [auth](../auth.md)에 있다. 여기는 연 뒤 Stack에 무엇이 남는지만 적는다.

| 들어온 것                                                             | 여는 곳                                                                                                                                               | 끝난 뒤                                                                                                                                                                       |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 초대 링크(`+native-intent`가 `/invite/[inviteCode]`로 바꾼다)         | 루트 Stack의 초대 카드. 로그인 전이면 가입·로그인, 로그인했으면 수락 버튼이다                                                                         | 수락 결과(환영 시트·친구 피드·내 초대)는 카드를 닫고 연다. 켜진 앱이면 있던 탭 묶음으로, 카드로 앱을 열었으면 목적지 탭 첫 화면을 깔고 연다. 뒤로 가도 카드로 돌아오지 않는다 |
| 로그인 전에 받은 초대(가입·로그인을 누른 카드, Android 설치 referrer) | `pendingRedemptionStoredValue`에 남겼다가 로그인 뒤 Index가 피드를 깔 때 그 위에 카드를 한 번 연다(`useOpenPendingInvite`). 피드가 먼저 보이지 않는다 | 꺼낸 초대는 바로 지운다. 로그인 전에 보던 카드는 초대 route가 `dangerouslySingular`라 새 카드가 대신한다                                                                      |
| 위젯(`aido://feed?…`·`aido://todo/{id}`)                              | 앱이 켜져 있으면 Expo Router가 연다. 로그인 전에 받은 첫 URL과 Android 명령은 `useWidgetAppEntry`가 인증 뒤 `openEntryHref`로 연다                    | 시트·상세 위에서 눌러도 탭 묶음은 하나다                                                                                                                                      |
| Android OAuth 콜백(`/auth/[provider]`)                                | 그리지 않는다. `useCloseOAuthCallback`이 브라우저 세션을 끝내고 로그인·계정 연결을 시작한 화면으로 돌아간다. 그 화면이 없으면 `/`다                   | 로그인은 Index가 이어 받아 남은 푸시·콜드 링크·초대를 연다. 계정 연결은 같은 연결 화면에 남는다                                                                               |

- 루트 Stack(초대 카드)에서 앱 화면으로 나갈 때는 `router.dismissTo(href, { withAnchor: true })`다. `replace`는 켜진 앱 위에 탭 묶음을 하나 더 쌓고, 앵커 없이 열면 시트 아래에 탭이 없다. 같은 Stack 안의 끝난 흐름(코드 입력 → 카드, 없는 코드 → 코드 입력)은 `replace`다.
- 탭 위 시트(환영 시트)에서 탭 화면으로 떠날 때는 `{ type: 'dismiss-to' }`이고, 볼 것이 없는 링크는 `exit()`(뒤로, 없으면 피드)다.
- Index가 첫 화면을 고르는 차례는 눌린 푸시 → 콜드 링크(`cold-start-link`) → 로그인 전 초대(피드 위) → 피드다. 로그인 화면·OAuth 콜백(`auth`)은 앱 입구라 이 차례를 건너뛰지 않는다(`useAppEntrySegmentSync`).

**새 진입 더하기.** 진입 하나는 스키마 하나와 처리 한 줄이다.

- 앱 화면 링크: route 파일 하나다(위 [탭과 함께 쓰는 화면](#탭과-함께-쓰는-화면) 표). 로그인 판정 전에 열린 보호 route는 `cold-start-link`가 첫 세그먼트로 받아 Index가 연다.
- 위젯 목적지: `widgetNavigationDestinationSchema`에 항목 하나, `findWidgetEntry`의 `match`에 한 줄(href·분석 값·이미 보이는지)이다. `exhaustive()`라 빠뜨리면 타입 검사가 막는다.
- 초대 링크 모양: `inviteLinkSourceSchema`에 값 하나(분석 `source`와 같다), `matchInviteLink`에 갈래 하나다.
- 링크·URI·저장 값은 외부 계약이라 추가만 한다. `auth-gate-layout.invite-entry.flow.test.tsx`·`auth-gate-layout.widget-entry.flow.test.tsx`·`oauth-callback-screen.test.tsx`가 출시한 링크·위젯 URI·이어서 열 초대 원문·콜백 URL 표로 착지와 뒤로 가기를 지킨다.

### 시트

- 시트도 route다. gorhom 시트를 `transparentModal` route(`SHEET_ROUTE_SCREEN_OPTIONS`, `shared/ui/bottom-sheet/sheet-route.ts`)에 그린다. 키보드를 따라 움직이고 60fps를 지키기 위해서다.
- 시트 route도 params 검증은 [params 튜플](#params-튜플)의 규칙과 같다.
- route 시트의 껍데기는 `RouteBottomSheet`(`fallbackHref`, `loading`, 입력이 있으면 `RouteKeyboardBottomSheet`) 하나다. 딥링크로 바로 열려 돌아갈 화면이 없으면 `fallbackHref`로 바꾼다. 폼이 시트와 `footer`를 함께 가져 경계가 시트 밖인 시트만 `useSheetRoute`를 직접 쓴다. route가 아닌 시트는 `useOpenSheet`(입력 시트는 `useOpenKeyboardSheet`)로 연다([ui-catalog](./ui-catalog.md)). 같은 시트에 route가 있으면 overlay로 다시 띄우지 않고 route로 간다(친구 독촉 콕).
- 링크로 바로 열릴 수 있는 시트 route는 여는 버튼이 하던 확인을 진입할 때 다시 한다. 카테고리 추가는 한도에 막혔으면 이름 시트 대신 한도 안내만 띄우고 끝나면 떠난다([design](../design.md#한도프리미엄ai-안내)).

### Link

- 상세로 가는 행은 모두 `<Link>` + `Link.Preview` + `Link.Menu`다(친구 할 일, 메모 카드, 친구(피드), 알림·보낸 콕, 리포트, 주간 성취, 말로 남긴 메모). 길게 누르기 동작은 `Link.MenuAction`으로 둔다.
- 제안 행과 댓글 행은 상세 route가 없어 Link를 붙이지 않는다. 제안은 수락·거절 버튼, 댓글은 길게 누르기 메뉴를 그대로 둔다.
- Link로 여는 것은 좁은 화면(compact)뿐이다. 넓은 화면의 pane 선택은 기존 `onPress`로 한다.
- 미리보기는 행과 같은 Stack이나 탭 위 루트 Stack의 화면만 붙인다. 탭(`(tabs)`)이나 안쪽 Stack(`weather`)의 화면은 미리보기가 그 navigator에 화면을 미리 넣어 params가 남을 수 있어 탭으로만 연다. 알림함은 탭 위 상세(`/todo/[todoId]`·`/nudges/[nudgeId]`)만 미리본다(`findRootStackDetailHref`).
- 끌기(재정렬) 모드의 행에는 Menu를 붙이지 않는다. 친구 목록은 평소에는 친구 피드(다른 탭)로 가는 Link + Menu(피드 보기·콕 찌르기·신고·차단)이고, 편집 모드에서는 Menu를 빼고 Link 안 누름을 꺼 바깥 행이 끌기를 받는다. 행 모양(바깥 누름·손잡이·내용 `LinearTransition`)은 두 모드에서 같게 둬 편집 전환 때 다시 그리지 않는다. iOS는 Menu가 있는 Link만 네이티브 감싸개를 써 Link 안쪽(`ListRow`)만 다시 그린다.
- 내 할 일 행은 상세로 가는 행이 아니라 Link를 붙이지 않는다. 길게 누르기는 끌어서 순서 바꾸기, 탭은 하위 할 일 펼치기이고 상세는 댓글 버튼으로 연다.
- 탭으로 여는 길은 두 가지다. ① 열 때 함께 할 일(읽음·추적·고르기)이 있거나 탭이 상황마다 다른 행은 행 `onPress`(`useSingleTap`)가 열고 Link의 `onPress`는 `event.preventDefault()`다(알림 `NotificationListRow.Link`, 메모 카드, 친구 할 일). ② 그 밖은 Link가 `navigate`로 연다(친구, 음성 메모, 성취, 리포트). `navigate`는 맨 위가 같은 화면이면 새로 쌓지 않아 연타에도 한 번이고, 행 안 버튼·`Link.MenuAction`도 같은 동사(`useSingleTap(router.navigate)`)로 연다. 어느 쪽이든 미리보기를 눌러 가는 이동은 Link가 맡는다. expo-router 58은 미리보기 탭 콜백을 공개하지 않아 이 길은 행 `onPress`를 거치지 않는다.
- 그래서 알림 행은 읽은 알림이고 게이트(프리미엄 안내 등)가 없을 때만 Link다. 안 읽은 알림을 미리보기로 열면 읽음이 빠지고, 게이트가 있으면 미리보기로 건너뛴다. 남는 빈틈은 미리보기로 연 읽은 알림의 `notification_center_opened` 추적뿐이다.
- `Link.Preview`·`Link.Menu`는 iOS에서만 그려진다. 메뉴에만 있는 동작(메모 카드 고정·삭제, 음성 메모 삭제)은 행의 `accessibilityActions`로 플랫폼과 상관없이 스크린리더에 두고, Android 손가락 길은 1.15.1과 같이 상세 화면의 ⋯ 메뉴·툴바다(새 길게 누르기 메뉴를 만들지 않는다). 전부터 길게 누르기로 하던 동작(받은 응원 신고, 댓글 메뉴)은 행 `onLongPress`로 남기고 `accessibilityActions`도 함께 둔다.
- 두 번 탭, Preview, Menu는 RNTL을 통과한 뒤 기기에서 확인한다([testing](../testing.md)). Jest의 `expo-router` 목은 `Link`를 행 `onPress` → Link `onPress` → 막지 않았으면 `router.navigate` 순서로 흉내 낸다. `Link.Preview`(`testID="link-preview"`)·`Link.Menu`·`Link.MenuAction`(`menuitem` 버튼)은 실제처럼 iOS에서만 그린다.

### 검색

- 친구 검색은 `Stack.SearchBar`다. 입력 반영은 es-toolkit `debounce`로 늦추고 직접 만든 debounce 훅을 쓰지 않는다.
