# AdaptivePane 컴포넌트

화면이 실제로 받은 폭(`usePaneSizeClass`)에 따라 목록과 상세를 나란히 놓는 List-detail 컨테이너입니다. 폴더블 펼침, 태블릿, 분할 화면에서 씁니다. 레이아웃을 힌지로 나누지 않습니다. 접힘선은 경계 위치만 맞춥니다.

```tsx
import { AdaptivePane } from '@src/shared/ui';
```

## 창 폭이 아니라 영역 폭

iPad에서 NativeTabs(`preferredPlacement="automatic"`) 사이드바가 열리면 창 폭은 그대로인데 탭 안이 사이드바만큼 좁아진다. 창 폭으로 나누면 세로 iPad·Split View에서 두 칸이 짓눌린다. 그래서 탭 Stack을 `PaneArea`로 감싸 탭이 받은 폭을 `onLayout`으로 재고, 칸 나누기는 그 폭으로 정한다. 규칙은 `WindowLayoutPolicy`(`shared/domains/window-layout.model.ts`)에 있다.

- `PaneArea`: 할 일·메모·마이 탭의 Stack 레이아웃이 감싼다. 탭 위에 여는 화면(날씨 등)은 사이드바가 없어 감싸지 않고 창 폭을 쓴다.
- `usePaneSizeClass()`: 칸을 나눌지, 고른 항목을 칸에 열지 push할지(`useFeedSelectedTodoId`·`useSelectedMemoId`·`useOpenDetailWhenCompact`·마이 탭 메뉴)를 정한다. 같은 폭을 봐야 칸은 하나인데 고른 항목이 칸에 열리는 어긋남이 없다.
- `usePaneColumns()`: 두 칸인지와 목록 칸 폭(320/400, 접힘선 x, 한 칸이면 영역 전체)이다. `AdaptivePane`·마이 탭 칸·달력·날씨 배경이 쓴다.
- 재기 전 첫 프레임은 창 폭으로 어림한다. 사이드바가 열린 채 들어오면 한 프레임 두 칸으로 그렸다가 한 칸이 될 수 있고, 목록 칸은 같은 트리 슬롯이라 다시 마운트되지 않는다.
- `useWindowSizeClass()`는 창 전체 정책(시트·말로 메모 화면·알림에서 여는 경로)에 남긴다. 알림이 창 폭으로 `/feed?todoId=`를 골랐는데 탭 안이 좁으면 피드의 `useOpenDetailWhenCompact`가 상세로 넘긴다.

## 동작

| size class | 폭        | 렌더링                                                 |
| ---------- | --------- | ------------------------------------------------------ |
| `compact`  | 600 미만  | `primary`만. 목록 화면의 상세는 라우트 push가 대신한다 |
| `medium`   | 600 ~ 839 | `primary`(320 고정) \| `secondary`(나머지)             |
| `expanded` | 840 이상  | `primary`(400 고정) \| `secondary`(나머지)             |

- Mac(Designed for iPad)은 폭과 관계없이 `compact`다(`IS_IOS_APP_ON_MAC`). Expo 권장이 아니라 데스크톱에서도 모바일과 같은 경험을 주려는 제품 결정이다. 시작할 때 정해지는 상수라 첫 프레임부터 1열이다.
- 각 pane을 `SafeAreaProvider`로 감싼다. pane 안의 `SafeAreaView`·`useSafeAreaInsets`는 창이 아닌 그 pane이 실제로 겹치는 safe area만 받는다. iPhone Duo는 접혀도 펼쳐도 탭 바·상태 표시를 좌우 세로 레일로 옮기는데, 펼친 2-pane에서는 레일에 닿는 pane만 inset을 받는다.
- 첫 프레임에는 그 pane이 닿는 가장자리의 창 inset만 `initialMetrics`로 준다(`getPaneEdgeInsets`, RTL이면 좌우를 바꾼다). 네이티브 측정 전에 레일 반대쪽 pane이 84pt 들여 그려졌다가 튀는 시프트를 막는다.
- 컨테이너는 가로 inset을 적용하지 않는다. pane 내용이 스스로 피한다: 스크롤 내용은 `<StyledSafeAreaView edges={['left', 'right']}>`로 감싸고(스크롤바와 배경은 가장자리까지), 고정 헤더·하단 버튼·빈 상태는 그 컨테이너에 `left`/`right`를 둔다. react-native-safe-area-context의 `SafeAreaView`는 가장 가까운 네이티브 provider의 inset을 쓰므로 같은 축의 `SafeAreaView`를 중첩하지 않는다(중복 패딩). JS `SafeAreaInsetsContext`로 바꾼 값은 보지 않는다([칸 안의 safe area](#칸-안의-safe-area)).
- pane 폭은 size class별 최소 목록 폭(320/400)이고 상세 pane은 남은 폭을 채운다. 기기별 고정 폭이 아니라 영역 폭 기준이다.
- 반쯤 접어 세로 접힘선(reserved region `division`)이 생기면 목록 폭을 접힘선의 `frame.x`에 맞추고 접힘선 폭만큼 비운다. `AdaptivePane`이 `ReservedRegionsProvider`로 자기 좌표계를 만들고, 접힘선은 `findVerticalFold`로 찾는다.
- 펼친 화면에서 고른 항목은 URL param으로 상세 pane에 보여 준다. 접히면 항상 렌더링되는 목록 pane에서 `useOpenDetailWhenCompact(selectedId, openDetail)`로 상세 라우트에 넘긴다. 훅은 `useIsFocused`로 앞에 보이는 화면에서만 동작하므로, 뒤에 남아 있는 다른 탭은 push하지 않는다.
- 목록 밖(푸시·알림함 행)에서 여는 항목도 같은 기준을 따른다. 할 일은 `toTodoDetailRoute(windowSizeClass, …)`가 접힌 화면이면 `/todo/[todoId]`, 펼친 화면이면 `/feed?todoId=`(피드 상세 pane)를 고른다. 알림이 할 일 주인·날짜(`routing.todoOwnerId`·`todoDate`)를 실으면 목록 pane도 그 사람(친구면 `friendId`)의 그 `date` 피드로 연다. 없는 예전 알림은 내 피드 기본 날짜다.
- 하단 탭 바 높이를 가정한 여백을 두지 않는다.
- 목록 pane은 size class와 무관하게 같은 트리 슬롯에 둔다. 접기/펼치기에서 다시 마운트되지 않아 스크롤·입력 상태가 유지된다.

## 내 정보 메뉴 (전체 폭 헤더 + 화면마다 메뉴 칸)

마이 탭은 `AdaptivePane`을 쓰지 않는다. 오른쪽 칸 안에 Stack을 두면 네이티브 헤더가 목록 폭(400pt)에서 시작하는데, iPadOS 세로에서는 떠 있는 탭 바가 헤더 가운데에 놓여 2단계 화면의 뒤로 가기가 탭 바 밑에 가려진다. 그래서 헤더를 전체 폭으로 두고 메뉴를 각 화면 본문 왼쪽 칸에 그린다.

- 마이 탭 하위 화면은 탭 안 그룹 `app/(app)/(tabs)/(mypage)`에 둔다. 그룹 이름은 URL에 들어가지 않아 `/mypage`·`/settings/…`·`/friends…`·`/achievements…`·`/reports…`·`/whats-new/releases`가 그대로다. 탭 안 Stack이라 하위 화면에서도 탭 바(넓은 iPad·iOS 27 큰 iPhone에서는 사이드바)가 남는다.
- `(mypage)/_layout`은 라우트 목록과 제목만 두고, 조립은 `bootstrap/navigation/my-page-stack.tsx`의 `MyPageStack`이 한다. `menu` slot에 `MyPageMenuPane`을 받는다.
  - Stack `screenLayout`이 모든 화면을 같은 두 칸 틀로 감싼다. 좁은 화면은 화면만, 넓은 화면은 메뉴 칸(320/400, 접힘선이 있으면 그 위치)과 상세 칸이다. 화면은 size class와 무관하게 같은 트리 슬롯이라 접고 펴도 다시 마운트되지 않는다.
  - Stack 바깥 `SafeAreaProvider`가 탭 안 영역의 inset을 한 번 재고, 넓은 화면의 두 칸에는 닿는 가장자리의 inset만 `SafeAreaInsetsContext`로 넘긴다(`getPaneEdgeInsets`, RTL 포함). 칸마다 네이티브로 다시 재지 않아 헤더 아래 화면에서도 위 inset이 예전과 같다. 이 값은 JS context뿐이라 칸 안은 [칸 안의 safe area](#칸-안의-safe-area) 규칙으로 피한다.
  - 메뉴 칸(`MyPagePaneLayout`)은 `SafeAreaScrollView`로 칸 폭을 다 쓰고 내용이 홈 인디케이터 밑까지 스크롤된다. 위 inset은 좁은 화면 첫 화면만 지금 모양대로 주고, 넓은 화면은 전체 폭 헤더 바로 아래에서 상세 칸과 같은 높이로 시작한다.
- 좁은 화면은 Stack 첫 화면(`mypage/index`)이 메뉴를 그리고 하위 화면은 일반 push + 네이티브 뒤로 가기다. 넓은 화면의 첫 화면은 빈 안내이고, 헤더 제목(`내 정보`)을 둔다. 모든 화면의 헤더 높이가 같아야 메뉴 칸이 같은 자리에 있다. iPadOS는 위 탭 바가 헤더에 있으면 탭 첫 화면의 제목 글자를 숨겨 헤더가 한 줄 낮아지므로, iPad의 첫 화면은 제목을 `StackHeaderTitle` 뷰로 그려 하위 화면처럼 탭 바 아래 줄에 둔다. iPhone Duo·Android는 네이티브 제목이 보여 그대로 둔다.
- `unstable_settings.anchor = 'mypage/index'`라 푸시·링크로 하위 화면을 바로 열어도 아래에 메뉴가 깔려 뒤로 가면 메뉴다. 탭 레이아웃은 `anchor = 'feed'`로 탭을 정하지 않은 링크가 할 일 탭에 열리게 한다.
- 다른 탭이나 탭 위 화면에서 이 화면들을 열면 마이 탭으로 바뀌어 열린다(NativeTabs는 처음부터 모든 탭을 띄워 메뉴가 아래에 있다). 탭 위 흐름에서 탭 안 화면으로 떠날 때는 `router.dismissTo`로 탭을 새로 쌓지 않는다.
- 업셀 결제는 예외로 지금 맥락 위 모달(`/paywall`, `(app)/paywall.tsx`)로 연다. 마이 탭 메뉴·푸시는 `/settings/subscription` 그대로이고, 두 라우트는 `bootstrap/navigation/subscription-checkout.tsx`를 함께 그린다.
- 넓은 화면 옵션은 `getMyPageDetailOptions`(`features/identity/user/utils/my-page-detail-options.ts`)가 정한다. 첫 상세는 메뉴가 고른 화면이라 뒤로 가기·스와이프 없이 애니메이션 없이 바꾼다. 두 번째 단계부터는 네이티브 헤더의 뒤로 가기이고, 밀어 넣지 않고 `fade`로 겹쳐 바꾼다(스와이프도 같은 애니메이션, `animationMatchesGesture`). 메뉴 칸이 화면마다 같은 자리에 있어 상세만 바뀌어 보인다.
- 메뉴 이동은 메뉴 칸의 `MyPageMenuNavigationProvider`가 정한다(`useMyPageMenuNavigate`·`useIsMyPageMenuItemSelected`). 좁은 화면은 push, 넓은 화면은 쌓인 화면을 걷고(`dismissAll`) 고른 화면 하나를 연다. 메뉴 칸이 그리는 항목이 `router.push` 등으로 직접 이동하면 `check:conventions`가 거부한다.
- 종은 마이 탭 첫 화면 헤더의 `NotificationBellToolbar`(`Stack.Toolbar`) 한 곳이다.
- 메뉴는 쌓인 화면마다 그려지고 `useMyPagePaneLayout`이 스크롤 위치를 넘긴다. 앞에 보이는 화면의 메뉴만 위치를 저장하고, 새로 그린 메뉴는 내용·보이는 높이가 바뀔 때마다 저장된 위치로 다시 맞춘다. 그래서 화면을 쌓거나 접고 펴도 메뉴가 같은 자리다.

## 칸 안의 safe area

react-native-safe-area-context의 네이티브 `SafeAreaView`(`StyledSafeAreaView`)는 JS `SafeAreaInsetsContext`를 읽지 않는다. 뷰 계층에서 가장 가까운 네이티브 `SafeAreaProvider`의 `safeAreaInsets`를 쓴다(5.11.1 iOS `RNCSafeAreaViewComponentView findNearestProvider`, Android `SafeAreaView.findProvider`). 그래서 칸에 inset을 넘기는 방식에 따라 칸 안에서 쓰는 도구가 다르다.

| 칸                       | inset을 넘기는 방식                                   | 칸 안에서 쓰는 것                                                                                 |
| ------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `AdaptivePane` 목록·상세 | pane마다 네이티브 `SafeAreaProvider`                  | `StyledSafeAreaView`·`SafeAreaScrollView`·`useSafeAreaInsets` 모두 그 pane 값이다                 |
| 마이 탭 메뉴·상세 칸     | Stack 바깥 provider 하나 + JS `SafeAreaInsetsContext` | `SafeAreaScrollView`·`useSafeAreaInsets`. 네이티브 `SafeAreaView`는 탭 영역 전체의 inset을 읽는다 |

- 페이지 스크롤은 `SafeAreaScrollView`를 쓴다. 스크롤바와 배경은 칸 끝까지 가고, 가로 inset과 아래 inset(+여백)은 `contentContainerStyle`에 들어가 내용이 홈 인디케이터 밑까지 스크롤된다. 바깥을 `edges={['bottom']}`로 감싸 스크롤 영역을 홈 인디케이터 위에서 자르지 않는다.
- 칸은 불투명 네이티브 헤더 아래에서 시작하므로 칸 안에서 위 inset을 다시 주지 않는다.
- 마이 탭 상세 화면 중 목록·고정 버튼 화면(`achievements/index`, `friends`, `settings/blocked-users`, `settings/category-settings`, `settings/voice-storage`, 구독 결제)은 아직 네이티브 `StyledSafeAreaView`다. 레일이 상세 칸 쪽(오른쪽, LTR)이면 탭 영역 inset과 상세 칸 inset이 같아 맞는다. 레일이 메뉴 칸 쪽이면 상세에 레일 inset이 한 번 더 붙는다. 구독 결제(`SubscriptionCheckout`)는 업셀 모달(`/paywall`)과 같이 그려 모달 안 inset을 따르도록 네이티브로 둔다.

## `SplitView`·`ArrangementView`를 쓰지 않는 이유

1.15.0에서 시험했고 넣지 않았다. SDK 58에서 `SplitView`는 실험 기능이라 향후 다시 검토한다. expo-router 58.0.30·react-native-screens 4.30.1·@expo/ui 58.0.27 기준(2026-11 확인).

- **`SplitView`**: 다른 네이티브 내비게이터 안에서 throw해 루트를 Slot으로 바꿔야 하고, 왼쪽 칸은 라우트가 아니다. iOS 전용이다. 접힌 화면에서 `RNSSplitNavigationController`의 뒤로 가기가 모든 화면에 추가로 뜬다(react-native-screens #4858, 일반 iPhone에서도 재현).
- **`ArrangementView`**: iOS 27.1 미만은 컨테이너 없이 그려 시험에서 목록이 보이지 않았고, Android 대응이 없다. 시뮬레이터로 두 칸을 검증할 수 없다.

## 상세 pane 헤더

pane은 Stack 화면이 아니어서 네이티브 헤더가 없고, 꼭대기 바를 피처가 JS로 그린다(할 일 `TodoCommentTitleBar`, 메모 상세 pane 버튼 줄).

- 선택과 해제는 목록 pane이 맡는다. 상세 pane 첫 단계에는 뒤로가기·닫기 버튼을 두지 않는다. Android 하드웨어 뒤로가기는 댓글 단계를 먼저 되돌린 뒤 선택을 해제한다.
- 제목·보조 문구는 왼쪽 정렬 `Text` 토큰(b2 bold, e1)이라 글자 크기 설정을 따르고, 버튼은 44×44로 고정한다.
- 오른쪽에는 그 항목의 동작만 둔다(내 할 일은 ⋯ → `/todo/[todoId]/actions`, 메모는 고정·저장·⋯. AI·바꾸기·삭제는 ⋯ 메뉴의 `MenuActionItem`이다).
- pane 안에서 한 단계 들어간 화면(댓글 대화)만 그 안의 이전 단계로 돌아가는 뒤로가기를 둔다.
- 접힌 화면(compact)은 상세 라우트의 네이티브 헤더와 시스템 뒤로가기를 그대로 쓴다.

## 자리가 움직였는지 알기

`useAdaptivePaneLayoutKey()`는 영역 폭과 접힘선 위치를 합친 문자열이다(사이드바를 열고 닫아 칸이 옮겨 가도 바뀐다). 말풍선처럼 pane 안의 자리를 재어 띄운 것은 `CoachmarkPopover`의 `dismissKey`로 넘긴다(`VoiceNoteStartButton`). 자세가 바뀌어 자리가 움직일 때 읽기 시간 전이면 멈춘 뒤 새 자리에서 다시 열고, 충분히 읽었으면 끝낸다. 접힘선이 `AdaptivePane`의 좌표로 재어지므로 `primary`·`secondary` 안에서 부른다. 화면에서 부르면 앱 루트의 provider를 읽어 좌표가 달라진다.

## Props

| Prop        | 타입        | 설명                                   |
| ----------- | ----------- | -------------------------------------- |
| `primary`   | `ReactNode` | 목록 영역                              |
| `secondary` | `ReactNode` | 상세 영역. medium 이상에서 항상 렌더링 |

## 파일 구조

```
adaptive-pane/
├── adaptive-pane.tsx
├── adaptive-pane.types.ts
├── adaptive-pane.test.tsx
├── get-pane-edge-insets.ts
├── pane-area.tsx
├── index.ts
└── adaptive-pane.md
```
