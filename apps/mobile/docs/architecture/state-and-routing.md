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

- **원시 `setParams`를 내보내지 않는다.** 연관 값을 지우는 세터를 이름 있게 내보낸다(`useTodoCommentSort`는 `comment`를 함께 지운다). 호출부가 지우기를 잊을 수 없다. `router.setParams`는 params 훅 밖에서 쓰지 않는다(lint).
- **목록 행은 route 훅을 부르지 않는다.** 부모가 한 번 읽어 `isSelected`를 넘긴다. 가상 목록이 행 수만큼 URL을 파싱하지 않게 한다. 짧은 고정 목록은 행이 읽어도 된다.
- **레이아웃은 자식 params를 구독하지 않는다.** 레이아웃은 내비게이터와 Provider만 둔다. 루트에서 URL을 봐야 하는 훅은 `null`을 그리는 형제 컴포넌트에 둔다: `AuthGateLayout`의 `RouteWatchers`(`useScreenTracking`, `useWidgetAppEntry`, `useInviteAppEntry`, `useAppEntrySegmentSync`)와 `NotificationProvider`의 `ForegroundPushPresentation`. 스플래시 판단이 쓰는 "앱 입구인가"는 `useAppEntrySegmentSync`가 푸시 진입 슬롯에 적고 레이아웃은 슬롯만 읽는다. `setParams`가 레이아웃을 다시 그리지 않는 것은 `auth-gate-layout.test.tsx`가 지킨다.
- 화면 훅에서 `useGlobalSearchParams`를 쓰지 않는다. 보이지 않는 화면도 URL이 바뀔 때마다 다시 그려진다. 현재 화면과 무관하게 읽어야 하는 위의 `null` 자식만 쓴다.

| 스키마                     | 훅 → 반환                                                                                                                           |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `feedParamsSchema`         | `useFeedDateKey` → `[dateKey, setDateKey]`, `useFeedFriendId` → `[friendId, setFriendId]`, `useFeedAction`, `useFeedSelectedTodoId` |
| `friendListParamsSchema`   | `useFriendListView` → `[view, setView]`, `useFriendListIsEditing` → `[isEditing, setIsEditing]`(파일 하나)                          |
| `friendParamsSchema`       | `useRouteFriendId` → `[friendId]`(쿼리는 컴포넌트에서). 친구 피드는 `useRouteFriend()`가 찾음·읽는 중·실패·친구 아님 유니온을 준다  |
| `invitedFriendsViewSchema` | `useInvitedFriendsView` → `[view, setView]`                                                                                         |
| 그 밖                      | `useTodoSheetDateKey`·`useTodoCategoryId`·`useNudgeId`·`useVoiceNoteDraftId` → `[id]`, `useCheckoutRoute` → `[pathname, leaveTo]`   |

- 계산 값은 튜플이 아니다(`useDateFormatContext`는 값을 돌려준다). 저장소가 없는 구독 값(`useIsOnline`)과 동작 묶음도 튜플이 아니다.

## 라우팅

Expo Router 권장 방식을 따른다. 라우터 교체는 route 전체를 바꾸는 일이라 포트로 숨기지 않는다.

### 경로와 이동

- `app/`에는 route 파일만 둔다. route 화면 테스트는 `src/features/{feature}/__tests__/{route}-screen.test.tsx`다.
- 리소스는 폴더 route다. 세그먼트는 kebab-case, 동적 세그먼트는 `[{entity}Id]`다(`/todo/[todoId]`). `[id]`는 쓰지 않는다.
- 같은 화면의 보기 상태는 camelCase query param이다(`/feed?friendId=…&date=…`, `/memo?memoId=…`). 피드는 `/feed` 한 화면이고 친구 전환은 세터라 pane이 다시 마운트되지 않고 history가 쌓이지 않는다.
- 이동은 호출부에서 typed routes `router.push({ pathname, params })`로 쓴다. 컴파일 때 `pathname`과 동적 세그먼트를 검사하므로 href 래퍼를 만들지 않고 경로 문자열을 잇지 않는다.
- 목적지를 계산하는 곳은 하나다. 알림은 `features/notification/utils/notification-destination.view-model.ts`, 위젯은 `WidgetNavigationPolicy`다.
- 뒤로 가기는 `useGoBack({ fallbackHref })`, Android 뒤로 가기 버튼은 `useAndroidBackHandler`다([hooks](./hooks.md)).
- 웹 페이지(약관·공지)는 route가 아니라 `useOpenInAppBrowser`로 연다. 앱 자체 WebView는 없고 `aido://webview/…` 링크는 `+not-found`로 간다.
- 공개된 경로와 `aido://` URI는 외부 계약이다. 바꾸지 않고 새 경로는 추가만 한다([model](./model.md#호환-1152)).

### 내비게이터

- 탭은 `NativeTabs`(`expo-router/native-tabs`)이고 탭마다 `Stack`을 둔다. 헤더는 네이티브 헤더만 쓰고 버튼은 `Stack.Toolbar`로 단다. 피드·메모 탭은 화면과 무관한 왼쪽 날씨 배지를 레이아웃의 `Stack.Screen`에, 화면이 그리는 오른쪽 알림 종(`NotificationBellToolbar`)은 화면에 둔다. 한쪽으로 모으면 레이아웃이 화면 params를 구독하거나 화면이 바뀔 때 배지가 다시 그려진다.
- 조건이 있는 화면은 `Stack.Protected guard`로 막는다(인증 게이트, 푸시 온보딩, 관리자 화면).
- 메모와 말로 메모(`voice-notes`) 스택은 `slide_from_bottom`이다. `voice-notes`는 녹음을 실수로 잃지 않게 `gestureEnabled: false`다. 시스템 모달은 토스트·한도 안내를 가려 쓰지 않는다.
- `@react-navigation/*`를 직접 import하지 않는다. 테마와 `useHeaderHeight`도 `expo-router`·`expo-router/react-navigation`에서 가져온다.
- 플랫폼 분기는 컴포넌트·스크린의 UI 모양에서만 `process.env.EXPO_OS`로 한다. `Platform.OS`는 lint가 막고, service·model·utils에는 플랫폼 분기를 두지 않는다.

### 시트

- 시트도 route다. gorhom 시트를 `transparentModal` route(`SHEET_ROUTE_SCREEN_OPTIONS`, `shared/ui/bottom-sheet/sheet-route.ts`)에 그린다. 키보드를 따라 움직이고 60fps를 지키기 위해서다.
- 시트 route도 params 검증은 [params 튜플](#params-튜플)의 규칙과 같다.
- route 시트의 껍데기는 `RouteBottomSheet`(`fallbackHref`, `loading`, 입력이 있으면 `RouteKeyboardBottomSheet`) 하나다. 딥링크로 바로 열려 돌아갈 화면이 없으면 `fallbackHref`로 바꾼다. 폼이 시트와 `footer`를 함께 가져 경계가 시트 밖인 시트만 `useSheetRoute`를 직접 쓴다. route가 아닌 시트는 `useOpenSheet`(입력 시트는 `useOpenKeyboardSheet`)로 연다([ui-catalog](./ui-catalog.md)). 같은 시트에 route가 있으면 overlay로 다시 띄우지 않고 route로 간다(친구 독촉 콕).

### Link

- 상세로 가는 행은 모두 `<Link>` + `Link.Preview` + `Link.Menu`다(할 일, 메모, 친구, 알림, 리포트, 제안). 길게 누르기 동작은 `Link.MenuAction`으로 둔다.
- Link로 여는 것은 좁은 화면(compact)뿐이다. 넓은 화면의 pane 선택은 기존 `onPress`로 한다.
- 미리보기는 행과 같은 Stack의 화면만 붙인다. 탭(`(tabs)`)이나 안쪽 Stack(`weather`)의 화면은 미리보기가 그 navigator에 화면을 미리 넣어 params가 남을 수 있어 탭으로만 연다. 알림함(루트 Stack)은 `/todo/[todoId]`·`/nudges/[nudgeId]`만 미리본다(`findRootStackDetailHref`).
- 끌기(재정렬) 모드의 행에는 Menu를 붙이지 않는다. 친구 목록은 편집 모드에서 Link를 빼고 끌기만 남기며, 평소에는 친구 피드(다른 탭)로 가는 Link + Menu(피드 보기·콕 찌르기·신고·차단)다.
- 내 할 일 행은 상세로 가는 행이 아니라 Link를 붙이지 않는다. 길게 누르기는 끌어서 순서 바꾸기, 탭은 하위 할 일 펼치기이고 상세는 댓글 버튼으로 연다.
- 탭은 행의 `onPress`(`useSingleTap`으로 연타 막기, 읽음·추적)가 열고 Link의 `onPress`는 `event.preventDefault()`다. Link는 미리보기를 눌러 가는 이동만 맡는다(`NotificationListRow.Link`). expo-router 58은 미리보기 탭 콜백을 공개하지 않아 이 길은 행 `onPress`를 거치지 않는다.
- 그래서 알림 행은 읽은 알림이고 게이트(프리미엄 안내 등)가 없을 때만 Link다. 안 읽은 알림을 미리보기로 열면 읽음이 빠지고, 게이트가 있으면 미리보기로 건너뛴다. 남는 빈틈은 미리보기로 연 읽은 알림의 `notification_center_opened` 추적뿐이다.
- `Link.Preview`·`Link.Menu`는 iOS에서만 그려진다. 그 밖의 플랫폼과 Link가 아닌 행은 메뉴 동작을 행의 `onLongPress`로 남기고, 스크린리더 동작(`accessibilityActions`)은 플랫폼과 상관없이 둔다.
- 두 번 탭, Preview, Menu는 RNTL을 통과한 뒤 기기에서 확인한다([testing](../testing.md)). Jest의 `expo-router` 목은 `Link`를 행 `onPress` → Link `onPress` → 막지 않았으면 `router.navigate` 순서로 흉내 낸다. `Link.Preview`(`testID="link-preview"`)·`Link.Menu`·`Link.MenuAction`(`menuitem` 버튼)은 실제처럼 iOS에서만 그린다.

### 검색

- 친구 검색은 `Stack.SearchBar`다. 입력 반영은 es-toolkit `debounce`로 늦추고 직접 만든 debounce 훅을 쓰지 않는다.
