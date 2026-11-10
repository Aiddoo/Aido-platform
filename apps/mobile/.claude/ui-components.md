# UI 컴포넌트 사용 가이드

**Version**: 1.4.0 · **Last Updated**: 2026-11-10 · **Owner**: Aido Mobile Team

> 컴포넌트 선택 순서: HeroUI Native → Shared UI (`@src/shared/ui`) → React Native 기본.

## 컴포넌트 선택 순서

UI를 만들기 전에 위에서 아래로 찾는다. 바퀴를 다시 만들지 않고 모양과 동작을 앱 전체에서 맞추기 위해서다.

| 순서 | 어디서                                     | 언제                                                                                                                                            |
| ---- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | HeroUI Native 원본                         | 체크·칩·탭·팝오버·메뉴·누름처럼 원본이 있는 부품(`Checkbox`, `Chip`, `Tabs`, `Popover`, `Menu`, `PressableFeedback`, `Skeleton`, `Separator` …) |
| 2    | Shared UI (`@src/shared/ui`)               | 같은 역할의 부품이 이미 있을 때. 원본 대신 이것을 쓴다                                                                                          |
| 3    | 새 래퍼 (`shared/ui`나 피처 `components/`) | 원본에 앱 고유 역할(단위 suffix·숫자 포맷·도메인 문구·디자인 토큰 조합)이 더해질 때만                                                           |
| 4    | React Native 기본                          | 위에 없을 때만(`ScrollView` 등)                                                                                                                 |

컴포넌트 이름·props는 `.claude/skills/heroui-native`를 본다.

**글자와 레이아웃은 Shared UI가 먼저다.** `Text`, `H1`~`H4`, `TextSkeleton`, `WordWrapText`, `Box`, `HStack`, `VStack`, `Spacing`, `ReadableContent`를 쓰고 RN `Text`·`View`를 직접 쓰지 않는다. 숫자 크기 대신 `size` 토큰을 쓴다. 버튼·입력(`Button`, `Input`, `TextArea`)과 시트·다이얼로그(`BottomSheet` 3종, `ConfirmDialog`)도 `@src/shared/ui`에서 import한다.

```tsx
import { Box, Button, HStack, Text, VStack } from '@src/shared/ui';
import { Checkbox, Chip, Popover, Tabs } from 'heroui-native';
```

래퍼는 원본 props를 `Omit<ComponentProps<typeof X>, …>`로 확장하고 바꾸는 prop만 다시 선언한다. prop 이름은 원본 그대로다(`isOpen`/`onOpenChange`, `isSelected`/`onSelectedChange`, `value`/`onValueChange`). 역할 없이 원본을 넘기기만 하는 래퍼는 만들지 않는다([Wrapper Props 계약](#wrapper-props-계약)).

```tsx
interface QuotaChipProps extends Omit<ComponentProps<typeof Chip>, 'children'> {
  feature: EntitlementFeature;
}
```

부족한 부품을 `shared/ui`에 더하면 같은 커밋에서 폴더의 문서(`{name}.md`), 테스트, 아래 목록을 갱신한다.

### 한도·잠금 안내는 `useEntitlementGate` 하나

기능 한도에 닿았거나 프리미엄 기능을 눌렀을 때는 `useEntitlementGate(feature, { surface })`의 `promptIfBlocked`·`promptIfBlockedError`만 쓴다. 게이트가 `features/billing/subscription/components/premium-upsell-bottom-sheet.tsx`를 `useOverlay`로 띄운다. 시트는 사용량 막대(`Meter`)와 다시 생기는 날, "무료 → 프리미엄" 숫자를 서버 스냅샷에서 직접 읽고, 버튼은 [프리미엄 보기]와 글자 버튼 [나중에] 둘이다. 무료 대안(친구 초대, 지금까지 정리하기)이 있으면 대안이 주 버튼이고 [프리미엄 보기]가 글자 버튼이다.

같은 기능을 그날 [나중에]로 닫았으면 다음부터는 시트 대신 "프리미엄 보기" 행동이 붙은 토스트로 알린다(`UpsellPolicy.getPromptSurface`, 기록은 `UpsellDismissalRepository`). 기능 화면은 시트를 직접 렌더하지 않고, 기능별 `LimitReachedDialog`나 인라인 한도 배너를 새로 만들지 않는다. 앱 실행·홈·할 일 완료 축하에서는 권하지 않는다.

---

## Shared UI 컴포넌트 목록

| 컴포넌트                                                                                                         | 용도                                                                                                                                       | 문서                                                              |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `Text`, `H1`~`H4`                                                                                                | 텍스트, 헤딩 (`size="display"`는 날씨 큰 온도 전용)                                                                                        | `src/shared/ui/text/text.md`                                      |
| `Button`                                                                                                         | 기본 버튼                                                                                                                                  | `src/shared/ui/button/button.md`                                  |
| `KeyboardAdaptiveButton`                                                                                         | 키보드 반응 버튼                                                                                                                           | `src/shared/ui/button/button.md`                                  |
| `TextButton`                                                                                                     | 텍스트/링크 버튼                                                                                                                           | `src/shared/ui/text-button/text-button.md`                        |
| `NATIVE_TAB_ICON_SOURCES`                                                                                        | NativeTabs용 탭 아이콘 이미지(기본·선택)                                                                                                   | `src/shared/ui/icon/icon.md`                                      |
| `IconCountButton`                                                                                                | 아이콘 + 개수 버튼 (좋아요·답글·댓글)                                                                                                      | `src/shared/ui/icon-count-button/icon-count-button.md`            |
| `LineTabTrigger`, `SegmentTabTrigger`                                                                            | 밑줄·알약 `Tabs`의 글자 탭                                                                                                                 | `src/shared/ui/tab-trigger/tab-trigger.md`                        |
| `ViewTabs`                                                                                                       | URL 보기 값을 스키마로 검증하는 `Tabs`. `useView`와 함께 쓴다                                                                              | `src/shared/ui/view-tabs/view-tabs.md`                            |
| `Steps`                                                                                                          | 단계 진행 점(`Steps.Dots`)과 이전·다음 버튼(`Steps.Buttons`). 단계 상태는 `useStepper`                                                     | `src/shared/ui/steps/steps.md`                                    |
| `IconButton`                                                                                                     | 아이콘만 있는 버튼. role·label 필수, 터치 44                                                                                               | `src/shared/ui/icon-button/icon-button.md`                        |
| `IconCircle`                                                                                                     | 아이콘 하나를 담는 장식 원(`brand`·`outline`·`neutral`). 아이콘 색·크기는 쓰는 쪽이 정한다                                                 | `src/shared/ui/icon-circle/icon-circle.md`                        |
| `InfiniteList`                                                                                                   | 서버 커서 목록(FlashList 확장). 하단 로딩·재시도·중복 호출 방지·당겨서 새로고침                                                            | `src/shared/ui/infinite-list/infinite-list.md`                    |
| `TintedRefreshControl`                                                                                           | 앱 메인 색을 입힌 당겨서 새로고침. 원본 `RefreshControl`과 쓰는 법이 같다                                                                  | `src/shared/ui/tinted-refresh-control/tinted-refresh-control.tsx` |
| `InlineAlert`                                                                                                    | 흐름 안 배너(제목·설명·행동·닫기·이미지). 인라인 안내의 유일한 부품                                                                        | `src/shared/ui/inline-alert/inline-alert.md`                      |
| `Input`                                                                                                          | 입력 필드                                                                                                                                  | `src/shared/ui/input/input.md`                                    |
| `BottomSheetInput`                                                                                               | BottomSheet 내부 입력 필드                                                                                                                 | `src/shared/ui/input/input.md`                                    |
| `Spacing`                                                                                                        | 간격 유틸리티                                                                                                                              | `src/shared/ui/spacing/spacing.md`                                |
| `AspectRatio`                                                                                                    | 비율 박스(shadcn 인터페이스). 자식이 박스를 채운다. 바깥 크기는 부모가 정한다. `@src/shared/ui` 배럴이 아니라 `aspect-ratio/`에서 가져온다 | `src/shared/ui/aspect-ratio/aspect-ratio.md`                      |
| `FeatureMedia`                                                                                                   | 비율 고정 원격 이미지. 로딩 `Skeleton`, 실패 대체, 움직임 줄이기, 메모리·디스크 캐시                                                       | `src/shared/ui/feature-media/feature-media.md`                    |
| `Image`                                                                                                          | `expo-image`에 `className`을 받게 한 이미지. 비율·로딩 처리가 필요하면 `FeatureMedia`                                                      | `src/shared/ui/image/image.md`                                    |
| `Box`                                                                                                            | 단순 컨테이너                                                                                                                              | `src/shared/ui/box/box.md`                                        |
| `Flex`                                                                                                           | `HStack`·`VStack` 내부 구현. 방향이 값으로 바뀌는 곳만 직접 쓴다                                                                           | `src/shared/ui/flex/flex.md`                                      |
| `HStack`                                                                                                         | 수평 레이아웃                                                                                                                              | `src/shared/ui/h-stack/h-stack.md`                                |
| `AdaptivePane`, `useAdaptivePaneLayoutKey`, `PaneArea`, `usePaneSizeClass`, `usePaneColumns`                     | 영역 폭 기준 List-detail 2-pane (pane별 safe area, 전환 시 재마운트 없음, 탭 사이드바를 뺀 폭)                                             | `src/shared/ui/adaptive-pane/adaptive-pane.md`                    |
| `ReadableContent`                                                                                                | 넓은 창에서 폼·안내를 가운데 최대 폭(480)으로 모음                                                                                         | `src/shared/ui/readable-content/readable-content.md`              |
| `SafeAreaScrollView`                                                                                             | 내용만 가로·아래 inset을 피하고 배경·스크롤바는 칸 끝까지 가는 ScrollView (context inset)                                                  | `src/shared/ui/safe-area-scroll-view/safe-area-scroll-view.md`    |
| `ScreenScrollShadow`                                                                                             | 화면 배경 위 스크롤의 잘리는 쪽을 흐리게 덮음 (시트는 `SheetScrollShadow`)                                                                 | `src/shared/ui/screen-scroll-shadow/screen-scroll-shadow.md`      |
| `WordWrapText`                                                                                                   | 한글이 음절 사이에서 끊기지 않는 긴 글 (Android는 단어마다, iOS는 Text 하나)                                                               | `src/shared/ui/word-wrap-text/word-wrap-text.md`                  |
| `MenuActionItem`                                                                                                 | ⋯ 메뉴 항목. 주황 아이콘, 위험한 항목은 빨간색                                                                                             | `src/shared/ui/menu-action-item/menu-action-item.md`              |
| `VStack`                                                                                                         | 수직 레이아웃                                                                                                                              | `src/shared/ui/v-stack/v-stack.md`                                |
| `Grid`                                                                                                           | 그리드 레이아웃                                                                                                                            | `src/shared/ui/grid/grid.md`                                      |
| `GridItem`                                                                                                       | 그리드 아이템                                                                                                                              | `src/shared/ui/grid/grid.md`                                      |
| `Result`                                                                                                         | 결과 화면 (에러, 빈 상태)                                                                                                                  | `src/shared/ui/result/result.md`                                  |
| `TextArea`                                                                                                       | 여러 줄 텍스트 입력                                                                                                                        | `src/shared/ui/text-area/text-area.md`                            |
| `Avatar`                                                                                                         | 선택 가능 아바타 아이콘                                                                                                                    | `src/shared/ui/avatar/avatar.md`                                  |
| `ConfirmDialog`                                                                                                  | 중요 액션 확인용 다이얼로그 (cancelButton 선택적, 버튼 flex-1 자동화)                                                                      | `src/shared/ui/confirm-dialog/confirm-dialog.md`                  |
| `ChoiceRadio`                                                                                                    | 고르지 않은 원을 비운 테두리로 그리는 heroui `Radio`(다크 테마에서 고른 것처럼 보이지 않게). `RadioGroup.Item` 안에 둔다                   | `src/shared/ui/choice-radio/choice-radio.md`                      |
| `DashedDivider`                                                                                                  | 카드 안 구획을 나누는 점선 구분선 (실선은 HeroUI `Separator`)                                                                              | `src/shared/ui/dashed-divider/dashed-divider.md`                  |
| `HintPopoverContent`                                                                                             | 안내 말풍선 한 모양 (아이콘·제목·작은 X + 설명). `Popover` 안에 둔다                                                                       | `src/shared/ui/hint-popover/hint-popover.md`                      |
| `SettingsListGroup`(`.Item`·`.Toggle`·`.Radio`·`.Icon`·`.Content`·`.Separator`·스켈레톤), `SettingsScreenLayout` | 설정 카드와 행(`ListGroup`·`ControlField`·`RadioGroup`의 `.Radio` 기반, 가상 목록 조각 `.Segment`·빈 카드 `.Empty`), 설정 화면 스크롤 틀   | `src/shared/ui/settings-list-group/settings-list-group.md`        |
| `KeyboardBottomSheet`                                                                                            | 키보드 연동 바텀시트 (폼용)                                                                                                                | `src/shared/ui/bottom-sheet/bottom-sheet.md`                      |
| `BottomSheet`                                                                                                    | 키보드 불필요 바텀시트 (피커, 액션시트)                                                                                                    | `src/shared/ui/bottom-sheet/bottom-sheet.md`                      |
| `ModalBottomSheet`                                                                                               | `useOverlay`로 띄우는 바텀시트 (시트 위에 시트)                                                                                            | `src/shared/ui/bottom-sheet/bottom-sheet.md`                      |
| `SheetHeaderLayout`                                                                                              | `ModalBottomSheet`의 머리글(과 아래 줄)을 고정하고 본문만 스크롤                                                                           | `src/shared/ui/bottom-sheet/bottom-sheet.md`                      |
| `SheetRouteScreen`, `useSheetRoute`                                                                              | 대상이 있는 시트를 Expo Router transparentModal route로 띄우는 바탕과 닫기                                                                 | `src/shared/ui/bottom-sheet/bottom-sheet.md`                      |
| `useStackScreenOptions`, `useStackBackToolbar`, `StackHeaderTitle`                                               | 네이티브 Stack 헤더 공통 옵션, 중첩 Stack 첫 화면의 네이티브 뒤로가기, 네이티브 제목과 같은 제목 뷰                                        | `src/shared/ui/stack-header/stack-header.md`                      |
| `FormScrollView`                                                                                                 | 화면 폼 스크롤 (포커스한 칸 전체를 `footer` 버튼 위로)                                                                                     | `src/shared/ui/form-step-layout/form-step-layout.md`              |
| `FormStepLayout`                                                                                                 | 폼 단계 스크롤 영역 (가로 safe area · 페이드인 제목 · 입력 영역)                                                                           | `src/shared/ui/form-step-layout/form-step-layout.md`              |
| `ActionButton`                                                                                                   | 아이콘 + 라벨 선택 칩 (필터·옵션)                                                                                                          | `src/shared/ui/action-button/action-button.md`                    |
| `ListRow`                                                                                                        | 목록 행 (`left`·`contents`·`right`, `.Texts`·`.Image`, `onPress`면 행 전체가 버튼)                                                         | `src/shared/ui/list-row/list-row.md`                              |
| `Meter`                                                                                                          | 쓴 양 가로 막대(하위 할 일 진행, 남은 AI 횟수). 숫자 글자는 옆에 따로 둔다                                                                 | `src/shared/ui/meter/meter.md`                                    |
| `OverlayProvider`, `useOverlay`                                                                                  | 루트에 다이얼로그·시트를 띄운다. 값은 `openAsync`로 받는다                                                                                 | `src/shared/ui/overlay/overlay.md`                                |
| `OfflineBanner`                                                                                                  | 오프라인 한 줄 안내 (앱 루트에 한 번, `onlineManager` 기준)                                                                                | `src/shared/ui/offline-banner/offline-banner.md`                  |
| `QueryErrorBoundary`                                                                                             | Suspense 쿼리 오류 경계 (재시도·오류 보고)                                                                                                 | `src/shared/ui/query-error-boundary/query-error-boundary.md`      |
| `AppToast`                                                                                                       | 토스트 본문 (`useAppToast`로 사용)                                                                                                         | `src/shared/ui/toast/toast.md`                                    |
| `StyledSafeAreaView`                                                                                             | className을 받는 SafeAreaView                                                                                                              | `src/shared/ui/styled-safe-area-view/styled-safe-area-view.md`    |
| `ScallopedContainer`                                                                                             | 위아래 물결 가장자리의 카드 (AI 리포트·제안, 구독 혜택)                                                                                    | `src/shared/ui/scalloped-container/scalloped-container.md`        |
| `TextSkeleton`                                                                                                   | Text 크기별 줄 높이를 따르는 글자 스켈레톤                                                                                                 | `src/shared/ui/text/text.md`                                      |
| `Barcode`                                                                                                        | 영수증 톤 카드 아래쪽 바코드 장식 (구독 영수증, 초대 혜택)                                                                                 | `src/shared/ui/barcode/barcode.md`                                |

각 컴포넌트의 상세 Props와 사용 예시는 해당 컴포넌트 문서(`{name}.md`)를 참조하세요.

## 가로 safe area (iPhone Duo 세로 레일)

iPhone Duo(iOS 27.1)는 접힘·펼침 모두 탭 바와 상태 표시를 좌우 세로 레일로 옮긴다. Expo Router는 모든
화면을 SafeAreaView로 감싸지 않고, ScrollView의 `contentInsetAdjustmentBehavior`는 세로축만 처리한다
([Expo SDK 58](https://expo.dev/changelog/sdk-58), [react-native#59194](https://github.com/react/react-native/pull/59194)).

- 탭 안 Stack 화면의 페이지 ScrollView는 `SafeAreaScrollView`를 쓴다(네이티브 시트·모달은 그 안의 native inset을 따르도록 `StyledSafeAreaView`). 가로·아래 inset을 `contentContainerStyle`에 줘 스크롤바와 배경은 가장자리까지, 내용은 홈 인디케이터 밑까지 간다. 가상화 목록처럼 직접 스크롤을 둘 때는 안쪽 내용을 `<StyledSafeAreaView edges={['left', 'right']}>`로 감싼다.
- 고정 헤더·하단 버튼·빈/오류 상태·가상화 리스트 화면은 그 화면 루트 컨테이너의 `edges`에 `left`/`right`를 더한다.
- `SafeAreaView`는 가장 가까운 `SafeAreaProvider`의 inset을 쓴다. 같은 축을 중첩하면 두 번 패딩되므로 한 곳에만 둔다. 네이티브 Stack 헤더, `KeyboardAdaptiveButton`, 바텀시트, 토스트는 스스로 처리한다.
- `AdaptivePane`은 pane마다 provider를 두어 레일에 닿는 pane만 inset을 받는다.
- 화면 가장자리까지 닿는 가로 스크롤은 레일 밑까지 밀리고 내용만 피한다. 스크롤 뷰를 inset 안에 가두지 않고 내용 앞뒤 여백에 `useSafeAreaInsets()`의 그쪽 inset을 더한다(RTL이면 left·right를 앞뒤로 바꿔 읽는다). 지금은 친구 줄(`FriendStrip`)이다. 페이지 넘김 목록(달력 `calendar-pager`, 결제 혜택 `benefit-carousel`)은 쪽 폭이 칸 폭과 같아야 해 inset 안에 두고, 카드 안 목록(시간별 예보)과 시트 안 칩 줄(`SheetChipRow`, 반복 프리셋)은 카드·시트 가장자리까지라 레일과 닿지 않는다. 시트는 레일을 덮어 그린다(`getSheetLayout`).
- 화면 가장자리에 붙는 떠 있는 UI는 inset을 더한다. 토스트·Popover·Menu는 heroui가 `insets.left/right + 12`로 두고, 앱 토스트는 위 inset만 바꾼다. NativeTabs 위에서 `insets.bottom`에 탭 바 높이 상수를 더하지 않는다.
- 마이 탭 `MyPageStack`은 Stack 바깥에 provider 하나를 두고, 화면 안 두 칸에는 닿는 가장자리의 inset만 `SafeAreaInsetsContext`로 넘긴다. 이 값은 JS context라 네이티브 `SafeAreaView`에는 닿지 않는다. 칸 안에서는 `SafeAreaScrollView`·`useSafeAreaInsets`로 피한다([adaptive-pane.md](../src/shared/ui/adaptive-pane/adaptive-pane.md#칸-안의-safe-area)).
- Stack 화면 헤더는 네이티브 헤더와 `Stack.Toolbar` 네이티브 버튼을 쓴다. iOS가 레일·가로 바·Split View 바깥쪽으로 배치하고, 커스텀 뷰 버튼은 레일에서 빠진다([stack-header.md](../src/shared/ui/stack-header/stack-header.md)).

## Wrapper Props 계약

- Shared UI나 HeroUI Native 컴포넌트를 확장할 때는 `ComponentProps<typeof Original>`을 기준으로 한다.
- wrapper가 직접 구현하는 prop만 `Omit`한다. `className`, `style`, `testID`, 접근성 prop,
  `hitSlop` 같은 원본 확장 지점을 임의로 제거하지 않는다.
- 제어형 prop 이름은 원본을 유지한다. Shared Input/TextArea는 `value/onChange`, HeroUI Checkbox는
  `isSelected/onSelectedChange`, overlay는 `isOpen/onOpenChange`를 사용한다.
- `onChangeText` 변환은 Shared Input/TextArea 내부의 native TextInput 어댑터 한 곳에서만 한다.
- 폼을 소유한 컴포넌트가 제출 Promise를 소유하고, 입력은 RHF `Controller`의 `field`(`value`, `onChange`, `onBlur`, `ref`)와 `fieldState`만 받는다.
- `Input`과 `TextArea`의 `className`은 바깥 표면, React Native `style`은 실제 `TextInput`에 전달한다.
- `condition ? <Node /> : undefined`는 condition이 boolean인 JSX 노드에서
  `condition && <Node />`로 쓸 수 있다. 숫자·문자열 조건과 함수 prop에서는 `false` 노출이나 타입
  확장을 피하기 위해 삼항식을 유지한다.

## 목록: `FlashList`와 `.map`

| 목록                                                | 도구               | 예                                                                       |
| --------------------------------------------------- | ------------------ | ------------------------------------------------------------------------ |
| 개수가 정해지지 않거나 페이지로 받는 목록           | `FlashList`        | `NotificationList`, `UserList`, `VoiceNoteDraftList.All`, 녹음 저장 공간 |
| 상수로 개수가 제한되거나 한 화면에 다 들어가는 목록 | `.map`             | 말로 메모 미리보기(`VOICE_NOTE_PREVIEW_COUNT`), `KeyPointList`           |
| 개수가 고정된 스켈레톤·슬롯                         | es-toolkit `range` | `VoiceNoteDraftList.Loading`                                             |

- 합계·전체 삭제 같은 머리말·꼬리말은 `ListHeaderComponent`·`ListFooterComponent`에 둔다(녹음 저장 공간).
- RN `FlatList`는 달력(`calendar-pager.tsx`)과 시간별 예보에만 쓴다. 카테고리 목록(`category-list.tsx`)은 `FlashList`다. 새 목록에 쓰지 않는다.
- 할 일 `TodoList`와 메모 `MemoList`는 지금 `.map`이다. `MemoList`는 [미룬 일](../../../docs/releases/1.15.0/README.md#출시-후로-미룬-일)에 있다.

## 긴 글 줄바꿈: `WordWrapText`와 `lineBreakStrategyIOS`

Android에는 단어 단위 줄바꿈 Text prop이 없다. `lineBreakStrategyIOS`는 iOS에만 듣고, `WordWrapText`는 Android에서 단어마다 뷰를 만든다.

| 글                             | 도구                                 | 이유                                       |
| ------------------------------ | ------------------------------------ | ------------------------------------------ |
| 긴 안내 글                     | `WordWrapText`                       | iOS·Android 모두 단어 중간에서 끊지 않는다 |
| 가상화 목록 행, 행이 많은 목록 | `lineBreakStrategyIOS="hangul-word"` | 행마다 단어 수만큼 뷰가 늘지 않게 한다     |

- 줄 수 제한(`numberOfLines`)이나 글자 선택이 필요하면 `WordWrapText`를 쓰지 않는다.
- 말로 메모 자막은 문장 하나가 행이고 문장 단위로 가상화해 `WordWrapText`를 쓴다.

## 메뉴 항목: `MenuActionItem`

- ⋯ 메뉴의 행동은 heroui `Menu` 안에 `MenuActionItem`으로 둔다. `Menu.Item`을 직접 조합하지 않는다. 삭제·차단처럼 위험한 항목은 `variant="danger"`다.
- 고르는 메뉴(`Menu.ItemIndicator`, `TodoCommentSortBar`)는 `Menu.Item`을 쓴다.
- 네이티브 `Stack.Toolbar.Menu`의 아이콘 색은 시스템이 정한다. 접힌 스택과 펼친 pane은 항목과 순서를 같게 둔다.

## 이름

이름만 보고 무엇을 하는지, 어떤 원본을 확장했는지 알 수 있게 짓는다.

| 대상                   | 규칙                                                                           | 예                                                                    |
| ---------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| 원본을 확장한 컴포넌트 | 원본 이름으로 끝난다                                                           | `TodoCreateBottomSheet`, `ConfirmDialog`, `ActionButton`              |
| 그 외 컴포넌트         | PascalCase, 대상 + 역할                                                        | `MemoList`, `MemoEditor`, `WeatherHero`                               |
| 값을 입력받는 컴포넌트 | `…Input`                                                                       | `BottomSheetInput`                                                    |
| 피커 내용              | `*PickerContent`, `value`/`onChange`/`onCancel`                                | `TodoDatePickerContent`                                               |
| 파일                   | kebab-case, 주 컴포넌트·훅과 같은 이름                                         | `memo-list.tsx`, `use-memo-params.ts`                                 |
| 이벤트 prop / 핸들러   | `onX` / `handleX`                                                              | `onLeave`, `handleBack`                                               |
| 불리언                 | `is`, `has`, `can`, `should`                                                   | `isEditing`, `hasNextPage`                                            |
| 상태·route 훅          | 항상 튜플. `[value, setValue]`, `[{ a, b }, setValues]`, 읽기 전용은 `[value]` | `[selectedMemoId, setSelectedMemoId]`, `const [todoId] = useTodoId()` |
| 함수                   | 동사로 시작. `xxxOf`, `xxxFrom`, 대상 없는 `process`, `doX`, `runX` 금지       | `canCreateMemo`, `toMemoPreview`                                      |
| 변환·생성·불변 갱신    | `toX`, `createX`, `withX`                                                      | `toMemo`, `createMemoDraftKey`                                        |
| 상수                   | SCREAMING_SNAKE, 값의 뜻                                                       | `DEFAULT_PAGE_SIZE`, `EMPTY_MEMO_FORM_VALUES`                         |
| 타입, Props            | PascalCase, Props는 `XProps`                                                   | `MemoEditorProps`                                                     |
| 스키마                 | camelCase + `Schema`, 타입은 `z.infer`                                         | `memoSchema`, `Memo`                                                  |
| 축약                   | 쓰지 않는다                                                                    | `button`, `message`, `index`                                          |

- **쓰지 않는 이름:** `Section`, `Body`, `Frame`, `Wrapper`, `Inner`, 역할 없는 `Content`. 위치만 뜻해 분리 근거가 되지 않는다. 시트 안쪽의 `XBottomSheet.Content`와 null을 좁혀 넘기는 `X.Contents`는 쓴다.
- **네임스페이스:** `Item`, `Loading`, `Error`, `Empty`가 본체 없이는 의미가 없으면 본체 파일의 지역 컴포넌트나 compound member로 둔다.
- **반복 UI:** 의미 있는 작은 지역 컴포넌트로 조합한다. 필드가 독립적으로 달라질 수 있으면 짧다는 이유만으로 배열과 `map`으로 합치지 않는다.
- **먼저 찾기:** 이미 있는 shared layout, 입력, 버튼, 날짜 유틸을 먼저 찾는다. 같은 역할의 wrapper나 util을 다시 만들지 않는다.

## 도메인 다이얼로그와 안내 카드

- 도메인 다이얼로그는 `ConfirmDialog`를 감싸 `Omit<ComponentProps<typeof ConfirmDialog>, 'title' | 'description' | 'cancelButton' | 'confirmButton' | 'secondaryButton'>`로 확장한다. `isOpen`/`onOpenChange`는 원본 그대로 받고 문구·버튼은 안에서 채운다(`MemoDeleteDialog`). 사용법은 [confirm-dialog.md](../src/shared/ui/confirm-dialog/confirm-dialog.md)를 본다.
- 안내 배너(`PushPermissionNotice`, `WhatsNewEntryNotice`, `InviteEntryBanner`, `ReorderCoachmark`)는 `InlineAlert` 하나로 그린다. 기본 모양이 `rounded-xl bg-gray-1 px-4 py-3.5`다. 바깥 간격(`mx-4 mb-3`)은 컴포넌트가 아니라 Screen이 `className`으로 넘긴다.

## 상태·글꼴 배율·시트 규칙

- **레이아웃 프리미티브**: raw RN `View`/`Pressable` 대신 `Box`/`HStack`/`VStack`/`Grid`/`Spacing`/`ListRow`와
  HeroUI `PressableFeedback`을 쓴다. 예외는 shared/ui 내부 구현과 프리미티브가 지원하지 않는 native ref·Animated뿐이다.
- **스켈레톤**: `.Loading`은 `.Item`과 같은 레이아웃·슬롯에 `Skeleton`만 바꿔 넣는다. 글자 자리는 `TextSkeleton`
  (`useFontScaledSize`로 현재 글꼴 배율의 줄 높이), 고정 개수는 es-toolkit `range(n).map`이다([목록·스켈레톤](architecture.md#목록스켈레톤)).
- **진행 중**: 저장 버튼의 진행 표시는 mutation `isPending`을 `Button`의 `isLoading`에 넘긴다. 별도 `useState` 로딩이나
  화면 전체 스피너를 만들지 않는다.
- **상태 분기**: 탭·단계·결과처럼 서로 배타적인 상태는 union에 ts-pattern `match(...).with(...).exhaustive()`로 그린다.
- **글꼴 배율**: 버튼·칩·탭처럼 높이가 정해진 컨트롤은 고정 높이와 좌우 padding을 쓰고 글자에 맞춰 커지지 않게 한다.
  짧은 라벨(확인·취소·저장 등)은 iPhone SE에서 최대 글꼴 배율일 때 ko·en 모두 한 줄에 들어가야 한다. 긴 문구는
  `shrink`·`numberOfLines`로 줄인다([레이아웃 안전](i18n-guide.md#레이아웃-안전-영어-장문)).
- **간격**: 스크린의 구역 간격은 `Spacing`, 묶음 안 간격은 `HStack`·`VStack`의 `gap` prop이다. 그 밖의 여백은 `className`으로 쓴다. spacing prop(`p`, `pb` 등)과 `className`을 한 태그에 섞지 않는다(`check:conventions`가 막는다).
- **시트·다이얼로그**: 새로 만들지 않고 아래 [시트](#시트)와 `ConfirmDialog`를 쓴다. Reanimated 애니메이션은 `reduceMotion: ReduceMotion.System`을 지킨다.

## 넓은 화면과 기기

- **화면이 받은 폭으로 판단한다.** 1열·2열은 `usePaneSizeClass`(`compact`·`medium`·`expanded`)로 정한다. 탭 Stack을 감싼 `PaneArea`가 iPad 탭 사이드바를 뺀 폭을 재고, 탭 밖 화면은 창 폭이다. 창 전체 정책(방향·시트)은 `useWindowSizeClass`다. 규칙은 `WindowLayoutPolicy`에 있다. 기기 종류나 힌지로 레이아웃을 나누지 않는다.
- **2열은 `AdaptivePane` 하나다.** 접기·펼치기에서 pane이 다시 마운트되지 않는다. 접힘선은 경계 위치만 맞춘다(`findVerticalFold`). 상세: [adaptive-pane.md](../src/shared/ui/adaptive-pane/adaptive-pane.md).
  - 예외는 마이 탭 하나다. 상세 칸이 Stack이라 헤더를 전체 폭으로 두고 메뉴를 화면마다 본문 왼쪽 칸에 그린다(`MyPageStack`). iPadOS 세로의 떠 있는 탭 바가 칸 안 헤더의 뒤로 가기를 가리기 때문이다. [내 정보 메뉴](../src/shared/ui/adaptive-pane/adaptive-pane.md#내-정보-메뉴-전체-폭-헤더--화면마다-메뉴-칸).
- **Duo 세로 레일(84pt)과 iOS 분할 화면·배치 전환은 safe area inset으로 피한다.** [가로 safe area](#가로-safe-area-iphone-duo-세로-레일)를 따른다.
- **Mac(Designed for iPad)은 항상 `compact`다.** 제품 결정이다(`IS_IOS_APP_ON_MAC`).
- **방향은 화면이 정하지 않는다.** 휴대폰은 가로를 지원하지 않고, 태블릿과 펼친 폴더블·두 화면은 돌릴 수 있다. Android는 앱 설정에서 방향을 묶지 않고 창의 짧은 변이 600dp 미만이면 실행 중에 세로로 묶는다(`WindowLayoutPolicy.getOrientationLock`, `useOrientationLock`, [Android 큰 화면 방향 권장](https://developer.android.com/develop/adaptive-apps/cookbook/orientation-restriction)). 펼친 폴더블·태블릿은 가로로도 쓰므로 화면은 세로를 가정한 고정 높이를 두지 않고 창 높이에 맞춰 줄인다.

| 기기·자세                     | 창 짧은 변 | 방향                                                                                                    |
| ----------------------------- | ---------- | ------------------------------------------------------------------------------------------------------- |
| iPhone                        | -          | 세로(Info.plist). 앱은 실행 중에 바꾸지 않는다                                                          |
| iPad                          | -          | 네 방향(Info.plist, 분할 화면·Stage Manager). 앱은 실행 중에 바꾸지 않는다                              |
| Android 휴대폰                | 600dp 미만 | 세로로 묶는다. 기기를 돌려도 세로다                                                                     |
| 폴더블 접은 바깥 화면         | 600dp 미만 | 세로로 묶는다                                                                                           |
| 폴더블 펼친 안쪽 화면·태블릿  | 600dp 이상 | 푼다                                                                                                    |
| Surface Duo 한 화면 / 두 화면 | 540 / 720  | 한 화면은 세로, 두 화면에 펼치면 푼다                                                                   |
| Android 분할 화면·여러 창     | 창 기준    | 좁으면 세로를 요청하지만 여러 창에서는 시스템이 무시한다. 결정이 바뀔 때만 요청해 되풀이하지 않는다     |
| iPhone Duo                    | -          | 앱은 실행 중에 바꾸지 않는다. iOS 27은 지원 방향을 선호로만 보아 펼친 창이 가로일 수 있고 그대로 맞춘다 |

- Android 16+은 짧은 변 600dp 이상 화면에서 앱의 방향 요청을 받지 않는다. 접었을 때 건 세로 요청이 펼친 뒤에도 기록에 남지만(`dumpsys activity`의 `requestedOrientation`) 그 화면에서는 무시돼 돌릴 수 있다(Pixel Fold 에뮬레이터 API 36.1 확인).
- **`SplitView`·`ArrangementView`는 쓰지 않는다.** [이유](../src/shared/ui/adaptive-pane/adaptive-pane.md#splitviewarrangementview를-쓰지-않는-이유).

## 시트

상세와 이유는 [bottom-sheet.md](../src/shared/ui/bottom-sheet/bottom-sheet.md)가 원본이다.

| 컴포넌트                            | 용도                                          | 키보드 연동   |
| ----------------------------------- | --------------------------------------------- | ------------- |
| `KeyboardBottomSheet`               | 키보드가 필요한 폼 (텍스트 입력)              | O             |
| `BottomSheet`                       | 키보드 불필요 (피커, 액션시트)                | X             |
| `ModalBottomSheet`                  | 시트 위에 시트 (`BottomSheet` + `useOverlay`) | X             |
| `SheetRouteScreen`, `useSheetRoute` | 대상이 있는 시트를 Expo Router route로 띄움   | 안쪽 시트대로 |

- **그리는 곳:** 모든 시트는 HeroUI `BottomSheet` + `BottomSheet.Portal`이고 호스트는 `OverlayProvider`가 가진다. 앱 기본 PortalHost는 Query·DI 바깥이라 쓰지 않는다. HeroUI `*.Portal`을 직접 쓸 때는 `usePortalTarget()`을 펼쳐 넘긴다.
- **Context:** Portal은 Context를 잇지 못한다. 시트 안에서 읽는 Context는 시트 안에 둔다. 폼은 Context 없이 `form`·`control`을 props로 넘기고, `footer`에서 읽을 때도 그렇다.
- **스크롤:** 내용은 시트 안에서 스크롤되므로 세로 스크롤 컨테이너를 또 두지 않는다(가로 스크롤은 무방).
- **내용과 `footer`:** 내용(칩 줄·보내기 줄 포함)은 `children` 흐름에 두고, 작은 화면·큰 글자·키보드에 가려도 보여야 할 주 동작 버튼만 `footer`에 둔다. gorhom 동적 크기는 흐름의 내용만 재므로 시트가 첫 프레임부터 최종 높이로 올라온다.
- **안쪽 스크롤이 필요한 내용:** `enableContentPanningGesture={false}`로 내용을 끌어도 시트가 움직이지 않게 하고 높이는 `useKeyboardSheetBodyMaxHeight()`를 넘지 않게 고정한다.
- **닫기 전 할 일:** `KeyboardBottomSheet`의 바깥 탭·Android 뒤로 가기에서 할 일이 있으면 `onDismissRequest`를 넘긴다. 손잡이·내용 끌어내리기는 이 경로를 타지 않는다.
- **시트 위 시트:** `ModalBottomSheet`는 열릴 때 키보드를 스스로 내리므로 호출부에서 `Keyboard.dismiss()`를 부르지 않는다. 아래 시트의 입력에 다시 포커스할 때는 `onExit`가 아니라 `onCloseStart`에서 해서 키보드와 아래 시트가 함께 올라오게 한다.
- **머리글 고정:** "확인"이 머리글에 있는 시트는 `hasFixedHeader`를 주고 내용이 `SheetHeaderLayout`을 쓴다.
- **대상이 있는 시트:** Stack에 `SHEET_ROUTE_SCREEN_OPTIONS`로 등록하고 시트가 route hook으로 id를 읽어 조회한다. `sheet.close(next?)`, `sheet.exit()`로 떠난다.
- **배치:** `getSheetLayout`이 정한다(Duo 접힘선·레일, iPad 넓은 창의 좌우 여백).

## 키보드

[Expo 키보드 가이드](https://docs.expo.dev/guides/keyboard-handling/)대로 `react-native-keyboard-controller`를 쓴다. 입력이 있는 곳마다 아래 셋 중 하나다.

| 곳                                     | 스크롤                                                         | 주 동작 버튼                                   |
| -------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------- |
| 화면 폼                                | `FormStepLayout`·`FormScrollView`(칸 전체 스크롤)              | `KeyboardAdaptiveButton`(`KeyboardStickyView`) |
| 시트                                   | `KeyboardBottomSheet`(gorhom `keyboardBehavior="interactive"`) | 내용 흐름, 키보드에 가리면 `footer`            |
| 전체 화면 편집기·목록(메모, 친구 찾기) | `KeyboardAvoidingView behavior="padding"`                      | 화면 머리글 버튼                               |

- 화면 폼은 버튼을 `footer`로 넘긴다. 칸 전체(라벨·오류 문구·글자 수)를 버튼 위로 올리며, `KeyboardAwareScrollView`는 커서 줄만 올려 쓰지 않는다([FormStepLayout](../src/shared/ui/form-step-layout/form-step-layout.md#키보드)). 다음 칸은 `returnKeyType="next"`로 넘어간다.
- 키보드 시트도 [시트](#시트)의 내용과 `footer` 규칙을 따른다. `footer`가 키보드에 맞추는 방식은 [bottom-sheet.md](../src/shared/ui/bottom-sheet/bottom-sheet.md#keyboardbottomsheet), 자라는 `TextArea`의 상한은 [text-area.md](../src/shared/ui/text-area/text-area.md#내용에-맞춰-높이-확장)에 있다.
- 댓글처럼 목록 아래에 붙는 작성 바만 `KeyboardStickyView`를 직접 쓴다.

## 아직 옮기지 않은 것

아래 부품은 아직 HeroUI 원본 조합이 아니다. 옮길 때는 하나씩 전후 화면을 비교하고, 동등하지 않으면 유지한 뒤 이유를 남긴다. 2026-11-08에 heroui-native 1.0.11 소스로 다시 비교했고 다섯 부품 모두 같다고 보일 수 없어 유지했다.

| 부품                 | 옮길 모양                                           | 옮기면 달라지는 것(유지한 이유)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Input`, `TextArea`  | `TextField`, `Input`, `TextArea`, `FieldError` 조합 | 시트 키보드: heroui `Input`은 RN `TextInput`만 그린다. `BottomSheetInput`이 쓰는 gorhom `BottomSheetTextInput`(설치된 5.2.14 패치본)은 키보드 대상을 UI 스레드에서 바꾸고(`runOnUI`), 입력을 `textInputNodesRef`에 등록해 시트 안 입력 사이로 포커스를 옮겨도 대상을 지우지 않고, 사라질 때 대상을 정리한다. heroui `useBottomSheetAwareHandlers`는 JS 스레드에서 바꾸고 등록·정리가 없다. 오류 줄: `FieldError`는 `isInvalid`가 아니면 `null`이라 줄 자리를 잡지 않아 오류가 뜰 때 아래가 밀린다. `growsWithContent`: heroui `TextArea`는 높이 `h-32` 고정이고 내용에 맞춰 자라는 동작이 없다. 모양: 초점 표시가 iOS outline·Android 1.5px 테두리(accent)이고 선택·커서 색이 accent(앱 `main`과 다름), iOS `shadow-field`가 붙는다 |
| `PasswordInput`      | `InputGroup`                                        | `InputGroup.Input`이 heroui `Input`이라 위 `Input`의 모양 차이(초점 표시, 선택 색, 그림자)를 그대로 갖는다. 로그인·가입 화면에서 이메일(`Input`)과 비밀번호가 나란히 있어 차이가 바로 보인다. `InputGroup.Suffix`는 묶음 전체 높이에 절대 위치라 라벨·오류 줄을 묶음 밖에 따로 그려야 하고, 그러면 `Input`의 라벨·오류·`variant`·`size`를 다시 만들게 된다. 눈 버튼은 이미 공용 `IconButton`이다. `Input`을 옮길 때 함께 옮긴다                                                                                                                                                                                                                                                                                                     |
| 친구 검색            | `SearchField`                                       | `SearchField.Input`도 heroui `Input`이라 위와 같은 모양 차이가 있다. 지금 검색 칸에는 지우기 버튼이 없어 `SearchField.ClearButton`을 넣으면 동작이 늘고, 기본 라벨(`'Search'`, `'Clear search'`)은 영어 고정이라 `accessibilityLabel`로 ko·en 문구를 넘겨야 한다. 글꼴 5단계는 `resolveSize` 스타일을 따로 줘야 한다                                                                                                                                                                                                                                                                                                                                                                                                                |
| `AppToast`           | `Toast.Title`, `.Description`, `.Action` 조합       | 글꼴 배율: `Toast.Title`·`.Description`은 heroui `Text`에 `text-base`·`text-sm` 고정 크기와 overlay 색을 입혀 앱 글꼴 설정(`resolveSize`)을 따르지 않는다. 자식 `<Text>`를 넣으면 글자 안에 글자가 겹친 중첩 Text가 되어 줄 높이가 같다고 보일 수 없다. `Toast.Action`은 heroui `Button size="sm"`이라 높이·눌림 하이라이트·variant 색이 지금 알약(`px-3 py-1.5`, `bg-gray-6`)과 다르다. 위치는 `HeroUIProvider`의 `insets`·`placement`가 이미 맡는다                                                                                                                                                                                                                                                                               |
| `HintPopoverContent` | `Popover`의 `avoidCollisions`, `insets`             | 뒤집기: heroui `avoidCollisions`는 위아래를 뒤집지 않고 `insets` 안으로 위치만 자른다(`use-relative-position`). 자리가 모자라면 말풍선이 트리거를 덮고 화살표는 원래 방향 그대로다. 앱 `getHintPlacement`는 자리가 더 많은 쪽으로 뒤집는다(`hint-popover.test.ts`). 왼쪽 배치의 폭 계산(`getHintWidth`)도 heroui에 없다                                                                                                                                                                                                                                                                                                                                                                                                             |

### HeroUI로 옮긴 것 (계획 2.7)

| 부품             | 지금                                                                    | 비고                                                                                                                        |
| ---------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `Button`         | heroui `Button`(`feedbackVariant="scale"`) + 앱 높이 4종·색·`isLoading` | role과 `accessibilityState`는 heroui가 넣는다. 눌림 하이라이트는 기존 옅은 회색을 자식 `PressableFeedback.Highlight`로 유지 |
| `TextButton`     | heroui `LinkButton`(ghost) + 자식 `Text`                                | 눌림은 크기 변화만(기존과 같다). 비활성은 `disabled:opacity-40`                                                             |
| 닫기 버튼 10곳   | heroui `CloseButton variant="ghost"` + 앱 `CloseIcon` 자식              | 기존 아이콘 자리는 `className`/`style`로 지키고 `hitSlop` 12로 44를 채운다. `picker-header`는 터치 20에서 44가 됐다         |
| 로딩 표시 4곳    | heroui `Spinner`                                                        | 색은 기본(accent)                                                                                                           |
| 구분선           | heroui `Separator thickness={1}`(날씨 카드는 0.5)                       | 세로 구분선은 `orientation="vertical"`                                                                                      |
| 정적 칩          | heroui `Chip` + 자식 `Text`                                             | `self-start` 기본이라 가운데 정렬 줄에서는 `self-center`를 준다                                                             |
| 색 고르기        | heroui `RadioGroup`(색 원은 `RadioGroup.Item` 자식)                     | role `radiogroup`·`radio`는 heroui가 넣는다                                                                                 |
| 아이콘 단독 버튼 | `IconButton`                                                            | 레이아웃을 지키려 `min-h-0 min-w-0`로 줄이고 `hitSlop`으로 44를 채운다. 라벨이 없던 곳에 라벨을 더했다                      |

### 칩 크기 단계

heroui `Chip`은 쓰임에 따라 아래 셋 중 하나로 고정한다. `size`·`variant`를 먼저 고르고, `className`은 배경색과 표에 적힌 덮어쓰기만 쓴다. 높이는 기본 글꼴 기준이며 글자 줄 높이 + 세로 여백 두 번이다.

| 단계           | 쓰임                                               | Chip                              | 덮어쓰기 | 글자                | 가로·세로·높이        | 예                                                                |
| -------------- | -------------------------------------------------- | --------------------------------- | -------- | ------------------- | --------------------- | ----------------------------------------------------------------- |
| 섹션 머리 알약 | 목록 묶음의 머리. `+` 같은 아이콘이 함께 붙는다    | `size="md"` `variant="secondary"` | `px-2.5` | `b4` semibold       | 10 · 4 · 27           | `CategoryHeaderPill`(할 일 목록·친구 피드·상세·결과 시트·새 기능) |
| 라벨 배지      | 행·카드 안의 상태·등급·횟수·할인·추천·새 기능 표시 | `size="sm"`                       | 없음     | `e1`(빽빽하면 `e2`) | 8 · 2 · 21(`e2`는 20) | `AccessTierChip`, `QuotaChip`, `ReportTypeChip`, 요금제 할인      |
| 누르는 제안 칩 | 눌러서 값을 채우는 제안                            | `size="md"`                       | 없음     | `b3` medium         | 12 · 4 · 28           | 이메일 도메인 제안                                                |

- `soft` + `accent` 라벨 배지의 글자는 `text-accent-soft-foreground`다. `tone="brand"`(`text-main`)는 연한 accent 면에서 대비가 2.6:1이라 12px 글자에 모자라고, soft-foreground는 라이트 4.1:1·다크 4.2:1이다.
- radius는 Chip 기본값을 쓴다. 세 단계 모두 radius가 높이의 절반 이상이라 양끝이 둥근 알약이 된다.
- 날씨 브리핑 칩(하늘 장면 위, 아이콘 + 값)은 장면 전용 모양이라 이 표 밖이다. 눌리는 칩(`ActionButton`, 오늘, 반복 프리셋)은 heroui `Chip`이 아니다(아래 표).

### 그대로 둔 것과 이유

동등하지 않으면 유지한다는 규칙에 따라 아래는 바꾸지 않았다.

| 대상                                                                                               | 이유                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ActionButton`, 눌리는 칩(오늘 칩, 반복 프리셋·요일)                                               | heroui `Chip`은 `PressableFeedback`이 아니라 `Pressable`이라 눌림 크기 변화가 사라진다. 요일 `TagGroup`은 프리셋·요일이 한 가로 `ScrollView`에서 폼 값으로 토글되는 구조와 맞지 않는다 |
| 행 버튼 13곳 `ListGroup.Item`                                                                      | `ListRow`가 앱 글꼴·들여쓴 구분선·슬롯을 이미 맡는다. `ListGroup.Item`의 제목·설명은 heroui 글꼴이고 안쪽 여백 16이 달라 모양이 바뀐다                                                 |
| 구분선 `border-t` 컨테이너(반복 푸터), `AdaptivePane`, `DashedDivider`, `Input`/`Tabs` 아래 테두리 | 컨테이너 테두리이거나 점선·교체 금지 대상이다                                                                                                                                          |
| `Menu.Trigger asChild`의 더보기 버튼, 고정 크기 원형 버튼(메모 만들기, 빠른 말하기, 날씨 ⋯ 등)     | 크기·색이 버튼마다 달라 `IconButton` 기본(44)과 어긋난다. role과 라벨은 이미 있다                                                                                                      |
| key-point 시간 칩, 개발용 날씨 배지                                                                | 부모 `Pressable` 안의 `Text` 접근성 속성 또는 개발 전용이라 효과가 작다                                                                                                                |

Uniwind는 CSS 순서가 아니라 규칙의 구체성(variant가 붙으면 높음)과 같을 때 뒤에 온 클래스로 정한다. 그래서 heroui 기본 클래스를 `className`으로 덮을 수 있지만, `disabled:`처럼 variant가 붙은 기본값(`disabled:element-disabled`)은 같은 variant(`disabled:opacity-40`)로만 덮인다.

`OfflineBanner`는 아직 `shared/ui`에 있다.

---

## 스타일링 규칙

인라인 스타일 대신 **className (Tailwind)** 을 사용합니다.

```tsx
// 올바른 사용
<VStack className="flex-1 p-4 bg-white">
  <Text className="mt-2">콘텐츠</Text>
</VStack>

// 지양 - 인라인 스타일
<VStack style={{ flex: 1, padding: 16, backgroundColor: 'white' }}>
  <Text style={{ marginTop: 8 }}>콘텐츠</Text>
</VStack>
```

### 조건부 className: cn 유틸리티 사용

조건에 따라 className을 조합할 때 **반드시** `cn` 유틸리티를 사용합니다. 템플릿 리터럴로 직접 조합하지 않습니다.

```tsx
import { cn } from '@src/shared/utils/cn';

// ✅ 올바름 - cn 사용
<View className={cn('rounded-full', isSelected && 'border-2')} />
<View className={cn('w-8 h-8', isActive ? 'bg-main' : 'bg-gray-3')} />

// ❌ 금지 - 템플릿 리터럴 직접 조합
<View className={`rounded-full ${isSelected ? 'border-2' : ''}`} />
```

### 외부 컴포넌트: withUniwind로 래핑

외부 라이브러리 컴포넌트에 `className`을 사용하려면 `withUniwind`로 감싸야 합니다.

> 참고: https://docs.uniwind.dev/api/with-uniwind

**이미 래핑된 컴포넌트:**

```tsx
// StyledSafeAreaView - withUniwind로 래핑됨
import { StyledSafeAreaView } from '@src/shared/ui/styled-safe-area-view';

<StyledSafeAreaView className="flex-1 bg-white">{children}</StyledSafeAreaView>;
```

**새로운 외부 컴포넌트 래핑:**

```tsx
import { SomeComponent } from 'some-library';
import { withUniwind } from 'uniwind';

const StyledComponent = withUniwind(SomeComponent);

<StyledComponent className="flex-1 bg-white" />;
```

---

## 테마 색상 사용 (다크/라이트 모드)

### 필수: CSS 변수(Tailwind 클래스)만 사용

다크/라이트 모드가 제대로 작동하려면 **반드시** `global.css`에 정의된 CSS 변수를 사용해야 합니다.

**하드코딩된 색상은 테마가 변경되어도 바뀌지 않습니다!**

```tsx
// ❌ 금지 - 다크 모드에서 안 바뀜
backgroundColor: '#F5F5F5';
backgroundColor: 'white';
color: '#9CA3AF';
tabBarInactiveTintColor: '#8E8E93';

// ✅ 올바름 - 다크 모드에서 자동 변환
className = 'bg-gray-3';
className = 'bg-white';
className = 'text-gray-5';
```

### 사용 가능한 색상 변수

화면 배경은 `bg-white`, 카드는 `bg-gray-1`이다. 다크 모드 바텀시트 면은 `bg-gray-1`이라 시트 안 카드는 `dark:bg-gray-2`를 함께 쓴다. 날씨 화면만 하늘 장면을 배경으로 둔다.

| 변수                           | 용도                              |
| ------------------------------ | --------------------------------- |
| `bg-white`                     | 화면 배경 (다크 모드에서 #121212) |
| `bg-gray-1`                    | 화면 위 카드·묶음 배경            |
| `bg-gray-2` ~ `bg-gray-10`     | 배경색 계열                       |
| `text-gray-1` ~ `text-gray-10` | 텍스트 색상 계열                  |
| `bg-main`, `text-main`         | 메인 브랜드 색상                  |
| `bg-error`, `text-error`       | 에러 색상                         |
| `bg-success`, `text-success`   | 성공 색상                         |
| `bg-warning`, `text-warning`   | 경고 색상                         |
| `bg-background`                | 전체 화면 배경                    |
| `bg-surface`                   | 컴포넌트 표면                     |
| `text-foreground`              | 기본 텍스트                       |
| `text-muted`                   | 보조 텍스트                       |

### className으로 색상 적용 (권장)

```tsx
<Text className="text-gray-6">텍스트</Text>
<View className="bg-main" />
<View className="bg-white rounded-2xl" />  // 다크 모드에서 자동 변환
```

### JS에서 색상값이 필요한 경우: useResolveClassNames

Tabs의 `tintColor`처럼 **실제 색상 문자열**이 필요할 때 사용합니다.

> 참고: https://docs.uniwind.dev/theming/global-css

```tsx
import { useResolveClassNames } from 'uniwind';

function MyComponent() {
  const activeStyle = useResolveClassNames('text-main');
  const inactiveStyle = useResolveClassNames('text-gray-6');
  const borderStyle = useResolveClassNames('border-gray-2');

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: activeStyle.color,
        tabBarInactiveTintColor: inactiveStyle.color, // ✅ 하드코딩 금지
        tabBarStyle: { borderTopColor: borderStyle.borderColor },
      }}
    />
  );
}
```

Skia 캔버스나 SVG `stroke`·`fill`처럼 문자열 하나만 받는 곳은 `useResolvedColor('text-main')`(`shared/hooks/use-resolved-color`)를 씁니다. 색을 읽지 못하면 `'transparent'`를 돌려줘 `undefined`가 그리기 코드로 가지 않습니다. 같은 일을 하는 feature 훅을 따로 만들지 않습니다.

### SVG 아이콘 색상: createStyledIcon

SVG 아이콘에 `colorClassName`으로 색상을 적용하려면 `createStyledIcon`으로 래핑합니다.

```tsx
import { ArrowRightIcon } from '@src/shared/ui/icon';

// colorClassName으로 색상 적용 (width/height도 지원)
<ArrowRightIcon colorClassName="accent-gray-6" width={24} height={24} />

// color prop도 그대로 사용 가능
<ArrowRightIcon color="#999999" width={24} height={24} />
```

**새 아이콘 추가 시:**

```tsx
// src/shared/ui/icon/icons.ts에 추가
import NewIconSvg from '@assets/icons/ic_new.svg';

import { createStyledIcon } from './create-styled-icon';

export const NewIcon = createStyledIcon(NewIconSvg);
```

**아이콘을 받는 prop:** 크기·색을 부품이 정하면 컴포넌트를 받아 `Icon: StyledIcon`(`<MenuActionItem Icon={TrashIcon} />`, `<ActionButton.Icon Icon={CalendarIcon} />`), 호출부가 그려 넘기면 `icon: ReactNode`(`<IconButton icon={<CloseIcon />} />`)로 둘만 쓴다. `check:conventions`가 막는다.

---

## 애니메이션과 Expo 공식 스킬

Expo 공식 스킬(expo-animation·native-ui·data-fetching·router·ui)을 따른다.

- **Reanimated 4**: shared value는 `.get()`/`.set()`으로 읽고 쓴다(`progress.value =` 금지). worklet에서 JS 함수를
  부를 때는 `react-native-worklets`의 `scheduleOnRN`을 쓴다(`runOnJS` 금지).
- **스레드**: 매 프레임 바뀌는 값은 UI 스레드(shared value·`useFrameCallback`)에 두고 `setState`로 그리지 않는다.
  `useFrameCallback`은 쓰지 않을 때 `setActive(false)`로 끈다.
- **누름**: HeroUI `PressableFeedback` 또는 Reanimated CSS transition(transform). scale 0.97, 120ms,
  `cubicBezier(0.23, 1, 0.32, 1)`.
- **등장·전환**: layout animation(`FadeIn`·`FadeOut`·`LinearTransition`), 스프링은 `{ duration, dampingRatio }`로 쓴다.
- **모션 줄이기**: 애니메이션과 같은 PR에 넣는다. Reanimated는 `reduceMotion: ReduceMotion.System`, 반복·강조 모션은
  `useIsReduceMotionEnabled()`이 켜져 있으면 생략하고 색·투명도만 바꾼다.
- **햅틱**: DI의 `useHaptics()`로 행동 1회에 같은 프레임에서 한 번 울린다. `expo-haptics`를 직접 import하지 않는다.
  worklet에서는 기준점을 넘을 때만 `scheduleOnRN`으로 부른다.
- **오디오**: 녹음·재생은 `expo-audio`를 쓴다(녹음 조각을 잇는 다시 듣기는 `useAudioPlaylist`). `expo-av`는 쓰지 않는다.
- **데이터 화면 4상태**: 로딩(스켈레톤)·오류(`QueryErrorBoundary`)·빈 상태(`.Empty`)·데이터를 모두 그린다. 저장 실패는
  입력값을 지우지 않는다. 숫자 카운터는 `tabular-nums`로 폭이 흔들리지 않게 한다.
- **키보드**: [키보드](#키보드)를 따른다.
- **따르지 않는 것**: 할 일 추가 시트는 앱 디자인 시스템(`KeyboardBottomSheet`, rounded 32, 같은 칩)과 시트 안에서
  모드가 바뀌는 흐름 때문에 `@expo/ui` BottomSheet로 바꾸지 않는다.

## 애니메이션 상수

React Native Reanimated 애니메이션에서 duration, delay 값은 **반드시** `ANIMATION` 상수를 사용합니다.

```tsx
import { ANIMATION } from '@src/shared/constants/animation';

// ✅ 올바름
withTiming(value, { duration: ANIMATION.duration.slow });
withTiming(value, { duration: ANIMATION.duration.normal });
withDelay(ANIMATION.delay.short, withTiming(...));

// ❌ 금지 - 매직 넘버 하드코딩
withTiming(value, { duration: 300 });
withTiming(value, { duration: 200 });
```

| 상수                          | 값    | 용도                                      |
| ----------------------------- | ----- | ----------------------------------------- |
| `ANIMATION.duration.fast`     | 150ms | 빠른 전환                                 |
| `ANIMATION.duration.normal`   | 200ms | 일반 전환                                 |
| `ANIMATION.duration.slow`     | 300ms | 느린 전환                                 |
| `ANIMATION.duration.emphasis` | 600ms | 한 번 눈길을 끄는 강조(새 알림 종 흔들기) |
| `ANIMATION.delay.short`       | 50ms  | 짧은 지연                                 |
| `ANIMATION.delay.medium`      | 100ms | 중간 지연                                 |
| `ANIMATION.delay.long`        | 200ms | 긴 지연                                   |

---

## 금지 사항

### 1. 색상 하드코딩 금지 (중요!)

**다크/라이트 모드 지원을 위해 색상은 반드시 Tailwind 클래스를 사용해야 합니다.**

```tsx
// ❌ 금지 - 다크 모드에서 안 바뀜
backgroundColor: '#F5F5F5'
backgroundColor: 'white'
color: '#9CA3AF'
style={{ backgroundColor: 'white' }}

// ✅ 올바름
className="bg-gray-3"
className="bg-white"
className="text-gray-5"
```

### 2. Shared UI 컴포넌트 중복 import 금지

Shared UI에 있는 컴포넌트를 다른 곳에서 가져오면 안 됩니다.

```tsx
// ❌ 금지 - Shared UI에 Text가 있으므로
import { Text, View } from 'react-native';
```

### 3. 오버레이에 진행 중 상태를 넘기지 않기 (중요!)

`overlay.open(render)`·`overlay.openAsync(render)`는 **열 때의 클로저를 그대로 붙잡는다.** 부모가 다시 렌더돼도
그 클로저는 갱신되지 않으므로, 부모에서 읽어 props로 넘긴 반응형 값은 **열린 순간의
값에 얼어붙는다.** 로딩 표시가 영영 안 뜨고, 그 값으로 막던 중복 요청이 그대로 나간다.

띄우는 내용이 **자기 상태를 스스로 가져야** 한다. 콜백을 `Promise`로 받아 안에서 재고,
여는 쪽은 `mutateAsync`를 쓴다. 열 때 정해지고 변하지 않는 값(대상, 초기값)만 넘긴다.

```tsx
// ❌ 금지 - mutation.isPending이 false로 얼어붙는다
overlay.open(({ isOpen, close }) => (
  <SomeSheet
    isOpen={isOpen}
    onSubmit={(v) => mutation.mutate(v)}
    isSubmitting={mutation.isPending}
  />
));

// ✅ 올바름 - 시트가 보내는 동안을 스스로 안다
overlay.open(({ isOpen, close }) => (
  <SomeSheet
    isOpen={isOpen}
    onSubmit={async (v) => {
      const saved = await mutation.mutateAsync(v).catch(() => null);
      if (saved) {
        close();
      }
    }}
  />
));
```

> oxlint에는 이걸 잡을 `no-restricted-syntax`가 없어 규칙으로 강제하지 못한다.
> `useOverlay`의 JSDoc에도 같은 경고를 두었다.

---

## Compound Component 패턴

Loading 상태 등 서브컴포넌트가 있는 경우 **Named Function 패턴**을 사용합니다.

```tsx
// 메인 컴포넌트 - 함수 선언문 사용
export function MyComponent() {
  // ...
}

// 서브컴포넌트 할당
MyComponent.Loading = function Loading() {
  // ...
};

// 사용 예시
<Suspense fallback={<MyComponent.Loading />}>
  <MyComponent />
</Suspense>;
```

### 주의사항

- `Object.assign(Component, { SubComponent })` 패턴은 **사용하지 않습니다**
- 메인 컴포넌트는 **함수 선언문**(`function`)으로 작성합니다
- 서브컴포넌트는 `Component.SubName = function SubName()` 형태로 할당합니다

## AI 기능 표시

- AI를 쓰는 실행 지점에는 `AiFilledIcon`을 두고, 횟수를 쓰면 남은 횟수를 함께 보인다. 문구는 `useQuotaStatus`(글자), `QuotaChip`(알약)에서 가져온다.
- 쓸 때마다 묻는 Dialog는 두지 않는다. 처음 한 번 AI 동의, 횟수를 다 쓰면 `useEntitlementGate`의 프리미엄 안내 시트(그날 두 번째부터 토스트)만 띄운다. 실패해서 차감되지 않으면 그 자리에서 알린다.
- 프리미엄·관리자에게는 남은 횟수를 보이지 않는다. 전체 횟수는 내 정보의 `QuotaSummary`에서 본다.
