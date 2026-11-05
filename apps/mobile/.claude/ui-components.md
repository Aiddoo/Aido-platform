# UI 컴포넌트 사용 가이드

**Version**: 1.1.0 · **Last Updated**: 2026-11-04 · **Owner**: Aido Mobile Team

> 컴포넌트 선택 우선순위: HeroUI Native → Shared UI 래퍼 (`@src/shared/ui`) → React Native 기본.

## 컴포넌트 선택 우선순위

UI를 구현할 때 다음 우선순위를 **반드시** 따릅니다:

### 1순위: HeroUI Native 원본

새 UI는 먼저 [HeroUI Native](https://github.com/heroui-inc/heroui-native)에서 찾는다(`Checkbox`, `Chip`, `Tabs`,
`Popover`, `Dialog`, `PressableFeedback`, `Skeleton` …). 컴포넌트 이름·props는 `.claude/skills/heroui-native`를 본다.

```tsx
import { Checkbox, Chip, Popover, Tabs } from 'heroui-native';
```

단, `shared/ui`에 같은 역할의 래퍼가 이미 있으면 그 래퍼를 쓴다. `Button`, `Text`, `Input`/`TextArea`,
레이아웃 프리미티브(`Box`·`HStack`·`VStack`·`Flex`·`Spacing`)는 원본 대신 `@src/shared/ui`에서 import한다.

```tsx
import { Box, Button, HStack, Text, VStack } from '@src/shared/ui';
```

### 2순위: Shared UI 래퍼 (`Omit<ComponentProps<typeof X>, …>`)

원본에 앱 고유 역할(단위 suffix·숫자 포맷·도메인 문구·디자인 토큰 조합)이 더해질 때만 `shared/ui`나 피처
`components/`에 래퍼를 만든다. 원본 props를 `Omit<ComponentProps<typeof X>, …>`로 확장하고 바꾸는 prop만 다시
선언한다. prop 이름은 원본 그대로다(`isOpen`/`onOpenChange`, `isSelected`/`onSelectedChange`, `value`/`onValueChange`).

```tsx
interface QuotaChipProps extends Omit<ComponentProps<typeof Chip>, 'children'> {
  feature: EntitlementFeature;
}
```

역할 없이 원본을 그대로 넘기기만 하는 래퍼는 만들지 않는다([Wrapper Props 계약](#wrapper-props-계약)).

### 3순위: React Native 기본 컴포넌트 (최후의 수단)

HeroUI와 Shared UI 모두에 없는 경우에만 React Native 컴포넌트를 쓴다.

```tsx
import { FlatList, Image, ScrollView } from 'react-native';
```

### 한도 안내는 `PremiumDialog` 하나

AI 정리·녹음 정리 등 기능 한도에 닿았을 때는 기존 `PremiumDialog` 하나로 안내한다. 기능별 `LimitReachedDialog`나
인라인 한도 배너를 새로 만들지 않고, 게이트가 기능별 `title`·`description`(리셋 날짜는 `premiumDialog.resetsOn`)과
필요하면 대체 행동을 넘긴다.

---

## Shared UI 컴포넌트 목록

| 컴포넌트                                                             | 용도                                                                        | 문서                                                             |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `Text`, `H1`~`H4`                                                    | 텍스트, 헤딩 (`size="display"`는 날씨 큰 온도 전용)                         | `src/shared/ui/text/text.md`                                     |
| `FormField`                                                          | RHF Controller와 field 오류의 단일 바인딩 경계                              | `src/shared/ui/form-field/form-field.md`                         |
| `Button`                                                             | 기본 버튼                                                                   | `src/shared/ui/button/button.md`                                 |
| `KeyboardAdaptiveButton`                                             | 키보드 반응 버튼                                                            | `src/shared/ui/button/button.md`                                 |
| `TextButton`                                                         | 텍스트/링크 버튼                                                            | `src/shared/ui/text-button/text-button.md`                       |
| `NATIVE_TAB_ICON_SOURCES`                                            | NativeTabs용 탭 아이콘 이미지(기본·선택)                                    | `src/shared/ui/icon/icon.md`                                     |
| `IconCountButton`                                                    | 아이콘 + 개수 버튼 (좋아요·답글·댓글)                                       | `src/shared/ui/icon-count-button/icon-count-button.md`           |
| `Input`                                                              | 입력 필드                                                                   | `src/shared/ui/input/input.md`                                   |
| `BottomSheetInput`                                                   | BottomSheet 내부 입력 필드                                                  | `src/shared/ui/input/input.md`                                   |
| `Spacing`                                                            | 간격 유틸리티                                                               | `src/shared/ui/spacing/spacing.md`                               |
| `Box`                                                                | 단순 컨테이너                                                               | `src/shared/ui/box/box.md`                                       |
| `Flex`                                                               | Flexbox 레이아웃                                                            | `src/shared/ui/flex/flex.md`                                     |
| `HStack`                                                             | 수평 레이아웃                                                               | `src/shared/ui/h-stack/h-stack.md`                               |
| `AdaptivePane`                                                       | 창 폭 기준 List-detail 2-pane (pane별 safe area, 전환 시 재마운트 없음)     | `src/shared/ui/adaptive-pane/adaptive-pane.md`                   |
| `ReadableContent`                                                    | 넓은 창에서 폼·안내를 가운데 최대 폭(480)으로 모음                          | `src/shared/ui/readable-content/readable-content.md`             |
| `ScreenScrollShadow`                                                 | 화면 배경 위 스크롤의 잘리는 쪽을 흐리게 덮음 (시트는 `SheetScrollShadow`)  | `src/shared/ui/screen-scroll-shadow/screen-scroll-shadow.md`     |
| `VStack`                                                             | 수직 레이아웃                                                               | `src/shared/ui/v-stack/v-stack.md`                               |
| `Grid`                                                               | 그리드 레이아웃                                                             | `src/shared/ui/grid/grid.md`                                     |
| `GridItem`                                                           | 그리드 아이템                                                               | `src/shared/ui/grid/grid.md`                                     |
| `Result`                                                             | 결과 화면 (에러, 빈 상태)                                                   | `src/shared/ui/result/result.md`                                 |
| `TextArea`                                                           | 여러 줄 텍스트 입력                                                         | `src/shared/ui/text-area/text-area.md`                           |
| `Avatar`                                                             | 선택 가능 아바타 아이콘                                                     | `src/shared/ui/avatar/avatar.md`                                 |
| `ConfirmDialog`                                                      | 중요 액션 확인용 다이얼로그 (cancelButton 선택적, 버튼 flex-1 자동화)       | `src/shared/ui/confirm-dialog/confirm-dialog.md`                 |
| `DashedDivider`                                                      | 카드 안 구획을 나누는 점선 구분선 (실선은 HeroUI `Separator`)               | `src/shared/ui/dashed-divider/dashed-divider.md`                 |
| `HintPopoverContent`                                                 | 안내 말풍선 한 모양 (아이콘·제목·작은 X + 설명). `Popover` 안에 둔다        | `src/shared/ui/hint-popover/hint-popover.md`                     |
| `IconRadioItem`                                                      | `RadioGroup` 안의 라디오 행 (라벨 · 선택적 설명 · 선택적 아이콘 인디케이터) | `src/shared/ui/icon-radio-item/icon-radio-item.md`               |
| `SettingNavigation`, `SettingNavigation.Item`                        | 설정 화면 섹션 그룹 + 네비게이션 아이템 (Compound Component)                | `src/shared/ui/setting-navigation/setting-navigation.md`         |
| `SettingsCard`, `SettingsCard.Toggle`, `SettingsCard.ToggleSkeleton` | 설정 토글을 묶는 흰 카드 + ControlField 토글 + 같은 배치의 스켈레톤         | `src/shared/ui/settings-card/settings-card.md`                   |
| `KeyboardBottomSheet`                                                | 키보드 연동 바텀시트 (폼용)                                                 | `src/shared/ui/bottom-sheet/bottom-sheet.md`                     |
| `BottomSheet`                                                        | 키보드 불필요 바텀시트 (피커, 액션시트)                                     | `src/shared/ui/bottom-sheet/bottom-sheet.md`                     |
| `ModalBottomSheet`                                                   | Overlay 절대 위치 기반 바텀시트 (시트 위에 시트)                            | `src/shared/ui/bottom-sheet/bottom-sheet.md`                     |
| `SheetHeaderLayout`                                                  | `ModalBottomSheet`의 머리글(과 아래 줄)을 고정하고 본문만 스크롤            | `src/shared/ui/bottom-sheet/bottom-sheet.md`                     |
| `SheetRouteScreen`, `useSheetRoute`                                  | 대상이 있는 시트를 Expo Router transparentModal route로 띄우는 바탕과 닫기  | `src/shared/ui/bottom-sheet/bottom-sheet.md`                     |
| `useStackScreenOptions`, `useStackBackToolbar`                       | 네이티브 Stack 헤더 공통 옵션과 중첩 Stack 첫 화면의 네이티브 뒤로가기      | `src/shared/ui/stack-header/stack-header.md`                     |
| `FormStepLayout`                                                     | 폼 단계 스크롤 영역 (가로 safe area · 페이드인 제목 · 입력 영역)            | `src/shared/ui/form-step-layout/form-step-layout.md`             |
| `ActionChip`                                                         | 아이콘 + 라벨 선택 칩 (필터·옵션)                                           | `src/shared/ui/action-chip/action-chip.md`                       |
| `ListRow`                                                            | 썸네일·텍스트가 있는 목록 행                                                | `src/shared/ui/list-row/list-row.md`                             |
| `Overlay`, `useOverlay`                                              | 루트에 다이얼로그·시트를 띄우고 값을 Promise로 반환                         | `src/shared/ui/overlay/overlay.md`                               |
| `PremiumDialog`                                                      | 프리미엄·한도 안내의 유일한 다이얼로그(UI만). 기능에서는 게이트 훅으로 띄움 | `src/shared/ui/premium-dialog/premium-dialog.md`                 |
| `OfflineBanner`                                                      | 오프라인 한 줄 안내 (앱 루트에 한 번, `onlineManager` 기준)                 | `src/shared/ui/offline-banner/offline-banner.md`                 |
| `QueryErrorBoundary`                                                 | Suspense 쿼리 오류 경계 (재시도·오류 보고)                                  | `src/shared/ui/query-error-boundary/query-error-boundary.md`     |
| `ScrollProgressWidget`                                               | 스크롤 진행률 플로팅 위젯                                                   | `src/shared/ui/scroll-progress-widget/scroll-progress-widget.md` |
| `AppToast`                                                           | 토스트 본문 (`useAppToast`로 사용)                                          | `src/shared/ui/toast/toast.md`                                   |
| `StyledSafeAreaView`                                                 | className을 받는 SafeAreaView                                               | `src/shared/ui/styled-safe-area-view/styled-safe-area-view.md`   |
| `ScallopedContainer`                                                 | 위아래 물결 가장자리의 흰 카드 (AI 리포트·제안, 구독 혜택)                  | `src/shared/ui/scalloped-container/scalloped-container.md`       |
| `TextSkeleton`                                                       | Text 크기별 줄 높이를 따르는 글자 스켈레톤                                  | `src/shared/ui/text/text.md`                                     |
| `Barcode`                                                            | 영수증 톤 카드 아래쪽 바코드 장식 (구독 영수증, 초대 혜택)                  | `src/shared/ui/barcode/barcode.md`                               |

각 컴포넌트의 상세 Props와 사용 예시는 해당 컴포넌트 문서(`{name}.md`)를 참조하세요.

## 가로 safe area (iPhone Duo 세로 레일)

iPhone Duo(iOS 27.1)는 접힘·펼침 모두 탭 바와 상태 표시를 좌우 세로 레일로 옮긴다. Expo Router는 모든
화면을 SafeAreaView로 감싸지 않고, ScrollView의 `contentInsetAdjustmentBehavior`는 세로축만 처리한다
([Expo SDK 58](https://expo.dev/changelog/sdk-58), [react-native#59194](https://github.com/react/react-native/pull/59194)).

- 페이지 ScrollView는 안쪽 내용을 `<StyledSafeAreaView edges={['left', 'right']}>`로 감싼다. 스크롤바와 배경은 가장자리까지 간다.
- 고정 헤더·하단 버튼·빈/오류 상태·가상화 리스트 화면은 그 화면 루트 컨테이너의 `edges`에 `left`/`right`를 더한다.
- `SafeAreaView`는 가장 가까운 `SafeAreaProvider`의 inset을 쓴다. 같은 축을 중첩하면 두 번 패딩되므로 한 곳에만 둔다. 네이티브 Stack 헤더, `KeyboardAdaptiveButton`, 바텀시트, 토스트는 스스로 처리한다.
- `AdaptivePane`은 pane마다 provider를 두어 레일에 닿는 pane만 inset을 받는다.
- Stack 화면 헤더는 네이티브 헤더와 `Stack.Toolbar` 네이티브 버튼을 쓴다. iOS가 레일·가로 바·Split View 바깥쪽으로 배치하고, 커스텀 뷰 버튼은 레일에서 빠진다([stack-header.md](../src/shared/ui/stack-header/stack-header.md)).

## Wrapper Props 계약

- Shared UI나 HeroUI Native 컴포넌트를 확장할 때는 `ComponentProps<typeof Original>`을 기준으로 한다.
- wrapper가 직접 구현하는 prop만 `Omit`한다. `className`, `style`, `testID`, 접근성 prop,
  `hitSlop` 같은 원본 확장 지점을 임의로 제거하지 않는다.
- 제어형 prop 이름은 원본을 유지한다. Shared Input/TextArea는 `value/onChange`, HeroUI Checkbox는
  `isSelected/onSelectedChange`, overlay는 `isOpen/onOpenChange`를 사용한다.
- `onChangeText` 변환은 Shared Input/TextArea 내부의 native TextInput 어댑터 한 곳에서만 한다.
- 폼 부모는 FormProvider와 제출 Promise를 소유하고, FormField의 children은 value/onChange/onBlur와 해당 fieldState만 소비한다.
- `Input`과 `TextArea`의 `className`은 바깥 표면, React Native `style`은 실제 `TextInput`에 전달한다.
- `condition ? <Node /> : undefined`는 condition이 boolean인 JSX 노드에서
  `condition && <Node />`로 쓸 수 있다. 숫자·문자열 조건과 함수 prop에서는 `false` 노출이나 타입
  확장을 피하기 위해 삼항식을 유지한다.

## 파일 응집도와 이름

- 공개 컴포넌트 이름은 도메인과 기반 UI를 함께 드러낸다. Card를 확장하면 `{Domain}Card.tsx`처럼 짓는다.
- `Item`, `Loading`, `Error`, `Empty`가 본체 없이는 의미가 없으면 본체 파일의 지역 컴포넌트 또는
  compound member로 둔다.
- 반복 UI는 의미 있는 작은 지역 컴포넌트로 조합한다. 필드가 독립적으로 달라질 수 있으면 짧다는
  이유만으로 배열과 `map`으로 합치지 않는다.
- 이미 존재하는 shared layout, 입력, 버튼, 날짜 유틸을 먼저 찾는다. 같은 역할의 wrapper나 util을
  다시 만들지 않는다.

## 도메인 다이얼로그와 안내 카드

- 도메인 다이얼로그는 `ConfirmDialog`를 감싸 `Omit<ComponentProps<typeof ConfirmDialog>, 'title' | 'description' | 'cancelButton' | 'confirmButton' | 'secondaryButton'>`로 확장한다. `isOpen`/`onOpenChange`는 원본 그대로 받고 문구·버튼은 안에서 채운다(`PushPermissionDialog`). 사용법은 [confirm-dialog.md](../src/shared/ui/confirm-dialog/confirm-dialog.md)를 본다.
- 홈 안내 카드(`PushPermissionCard`, `MarketingPushOptInBanner`, `FeatureDiscoveryReentryCard`)는 같은 모양 `rounded-xl bg-gray-1 px-4 py-3.5`를 쓴다. 바깥 간격(`mx-4 mb-3`)은 컴포넌트가 아니라 Screen이 `className`으로 넘긴다.

## 상태·글꼴 배율·시트 규칙

- **레이아웃 프리미티브**: raw RN `View`/`Pressable` 대신 `Box`/`HStack`/`VStack`/`Flex`/`Grid`/`Spacing`/`ListRow`와
  HeroUI `PressableFeedback`을 쓴다. 예외는 shared/ui 내부 구현과 프리미티브가 지원하지 않는 native ref·Animated뿐이다.
- **스켈레톤**: `.Loading`은 `.Item`과 같은 레이아웃·슬롯에 `Skeleton`만 바꿔 넣는다. 글자 자리는 `TextSkeleton`
  (`useFontScaledSize`로 현재 글꼴 배율의 줄 높이), 고정 개수는 es-toolkit `times`다([목록·스켈레톤](architecture.md#목록스켈레톤)).
- **진행 중**: 저장 버튼의 진행 표시는 mutation `isPending`을 `Button`의 `isLoading`에 넘긴다. 별도 `useState` 로딩이나
  화면 전체 스피너를 만들지 않는다.
- **상태 분기**: 탭·단계·결과처럼 서로 배타적인 상태는 union에 ts-pattern `match(...).with(...).exhaustive()`로 그린다.
- **글꼴 배율**: 버튼·칩·탭처럼 높이가 정해진 컨트롤은 고정 높이와 좌우 padding을 쓰고 글자에 맞춰 커지지 않게 한다.
  짧은 라벨(확인·취소·저장 등)은 iPhone SE에서 최대 글꼴 배율일 때 ko·en 모두 한 줄에 들어가야 한다. 긴 문구는
  `shrink`·`numberOfLines`로 줄인다([레이아웃 안전](i18n-guide.md#레이아웃-안전-영어-장문)).
- **시트·다이얼로그**: 새로 만들지 않고 `SheetRouteScreen`(대상이 있는 route 시트)·`BottomSheet`/`KeyboardBottomSheet`·
  `ConfirmDialog`를 쓴다. 배치는 `getSheetLayout`(Duo 접힘선·레일, iPad 넓은 창의 좌우 여백)이 정하고, Android 뒤로가기는
  `useAndroidSheetBackHandler`가 소비한다. Reanimated 애니메이션은 `reduceMotion: ReduceMotion.System`을 지킨다.
- **iPhone Duo·큰 창**: 배치는 기기 종류가 아니라 창 크기 class(`useWindowSizeClass`: `compact`·`medium`·`expanded`)로
  정하고, 좁은 창(compact)과 넓은 창의 2-pane(`AdaptivePane`)만 구분한다. [Expo의 Supporting iPhone Duo](https://expo.dev/blog/supporting-iphone-duo)를
  따른다: 세로 레일(84pt)과 Split View·배치 전환은 safe area inset으로 처리하고(위 [가로 safe area](#가로-safe-area-iphone-duo-세로-레일)),
  접힘선은 reserved region의 실제 위치를 쓴다.

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

<StyledSafeAreaView className="flex-1 bg-gray-1">{children}</StyledSafeAreaView>;
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

| 변수                           | 용도                                    |
| ------------------------------ | --------------------------------------- |
| `bg-white`                     | 카드, 섹션 배경 (다크 모드에서 #121212) |
| `bg-gray-1` ~ `bg-gray-10`     | 배경색 계열                             |
| `text-gray-1` ~ `text-gray-10` | 텍스트 색상 계열                        |
| `bg-main`, `text-main`         | 메인 브랜드 색상                        |
| `bg-error`, `text-error`       | 에러 색상                               |
| `bg-success`, `text-success`   | 성공 색상                               |
| `bg-warning`, `text-warning`   | 경고 색상                               |
| `bg-background`                | 전체 화면 배경                          |
| `bg-surface`                   | 컴포넌트 표면                           |
| `text-foreground`              | 기본 텍스트                             |
| `text-muted`                   | 보조 텍스트                             |

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
        tabBarActiveTintColor: activeStyle.color as string,
        tabBarInactiveTintColor: inactiveStyle.color as string, // ✅ 하드코딩 금지
        tabBarStyle: { borderTopColor: borderStyle.borderColor as string },
      }}
    />
  );
}
```

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
// src/shared/ui/Icon/icons.ts에 추가
import NewIconSvg from '@assets/icons/ic_new.svg';

import { createStyledIcon } from './createStyledIcon';

export const NewIcon = createStyledIcon(NewIconSvg);
```

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
  `useReduceMotion()`이 켜져 있으면 생략하고 색·투명도만 바꾼다.
- **햅틱**: DI의 `useHaptics()`로 행동 1회에 같은 프레임에서 한 번 울린다. `expo-haptics`를 직접 import하지 않는다.
  worklet에서는 기준점을 넘을 때만 `scheduleOnRN`으로 부른다.
- **오디오**: 녹음·재생은 `expo-audio`를 쓴다(녹음 조각을 잇는 다시 듣기는 `useAudioPlaylist`). `expo-av`는 쓰지 않는다.
- **데이터 화면 4상태**: 로딩(스켈레톤)·오류(`QueryErrorBoundary`)·빈 상태(`.Empty`)·데이터를 모두 그린다. 저장 실패는
  입력값을 지우지 않는다. 숫자 카운터는 `tabular-nums`로 폭이 흔들리지 않게 한다.
- **키보드**: `react-native-keyboard-controller`를 쓴다.
- **따르지 않는 것**: 할 일 추가 시트는 앱 디자인 시스템(`KeyboardBottomSheet`, rounded 32, 같은 칩)과 시트 안에서
  모드가 바뀌는 흐름 때문에 `@expo/ui` BottomSheet로 바꾸지 않는다.

## 애니메이션 상수

React Native Reanimated 애니메이션에서 duration, delay 값은 **반드시** `ANIMATION` 상수를 사용합니다.

```tsx
import { ANIMATION } from '@src/shared/constants/animation.constants';

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

`overlay.open(render)`는 **열 때의 클로저를 그대로 붙잡는다.** 부모가 다시 렌더돼도
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
      if (saved) close();
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
