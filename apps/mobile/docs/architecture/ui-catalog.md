# UI 부품 카탈로그

UI는 heroui-native → `shared/ui` → React Native 순서로 고른다. 같은 역할의 부품은 앱에 하나다. 컴포넌트를 짜는 법은 [ui](./ui.md), 색·글꼴은 [design](../design.md)을 본다. heroui 부품 이름·props는 `node .claude/skills/heroui-native/scripts/get_component_docs.mjs <Name>`로 확인한다.

## 고르는 순서

| 순서 | 어디서        | 언제                                                                                                            |
| ---- | ------------- | --------------------------------------------------------------------------------------------------------------- |
| 1    | heroui-native | 원본이 있는 부품(`Checkbox`, `Chip`, `Tabs`, `Popover`, `Menu`, `PressableFeedback`, `Skeleton`, `Separator` …) |
| 2    | `shared/ui`   | 같은 역할의 공용 부품이 있으면 원본 대신 이것을 쓴다                                                            |
| 3    | 새 래퍼       | 원본에 앱 고유 역할(단위·포맷·도메인 문구·토큰 조합)이 더해질 때만                                              |
| 4    | React Native  | 위에 없을 때만(`ScrollView` 등)                                                                                 |

- 글자와 레이아웃은 `shared/ui`가 먼저다. RN `Text`·`View`·`Pressable`을 직접 쓰지 않는다. 예외는 `shared/ui` 내부 구현과 native ref·Animated가 필요한 곳이다.

## 역할별 부품

굵은 이름은 1.15.2에서 새로 만든 공용 부품이다. 아직 옮기지 않은 자리는 [migration-status](./migration-status.md)에 있다.

| 역할                | 쓸 것                                                                                                                                          | 판정                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 레이아웃·글자       | `Box`·`HStack`·`VStack`·`Grid`·`Spacing`·`ReadableContent`·`AdaptivePane`·`SafeAreaScrollView`, `Text`·`H1`~`H4`·`TextSkeleton`·`WordWrapText` | 유지. heroui Typography는 앱 11단계 크기 × 글꼴 5단계를 대신하지 못한다                       |
| 버튼·아이콘·닫기    | `Button`·`IconButton`·`TextButton`(heroui 확장), `KeyboardAdaptiveButton`, heroui `CloseButton`                                                | 유지                                                                                          |
| 목록·설정 행        | `ListRow`, `SettingsListGroup`(`ListGroup` 확장, 빈 카드 `.Empty`), `InfiniteList`                                                             | 유지. 빈 상태를 다시 그리지 않는다                                                            |
| 카드                | **`SurfaceCard`**                                                                                                                              | 직접 만든 카드와 직접 쓴 `Card`를 옮긴다                                                      |
| 입력                | `Input`·`TextArea`·`BottomSheetInput`, `PasswordInput`(auth 기능)                                                                              | 유지([이유](#직접-만든-부품을-둔-이유))                                                       |
| OTP·선택·체크·토글  | heroui `InputOTP`, `RadioGroup` + `ChoiceRadio`, **`Checkbox`**(shared 확장), `ControlField`(`SettingsListGroup.Toggle`)                       | 고르는 입력은 `RadioGroup.Item`                                                               |
| 칩                  | **`LabelChip`**, 누르는 칩은 `ActionButton`                                                                                                    | soft 칩 복제를 옮긴다                                                                         |
| 시트·다이얼로그     | `ConfirmDialog`(`useConfirmDialog().openAsync({ onConfirm })`, route가 그리면 `isOpen`·`onFinish`), **`useOpenSheet`**, **`RouteBottomSheet`** | [시트](#시트)                                                                                 |
| 팝오버·메뉴         | heroui `Popover` + `HintPopoverContent`, heroui `Menu` + `MenuActionItem` + **`MenuContent`**                                                  | 위험 항목 빨강은 하나                                                                         |
| 토스트·안내         | `useAppToast`, `InlineAlert`, `OfflineBanner`, **`QueryErrorFallback.Inline`**                                                                 | 흐름 안 배너는 `InlineAlert` 하나                                                             |
| 오류·빈 상태        | `QueryErrorBoundary`, `Result` + `shared/ui/illustration`의 그림                                                                               | 톤은 [design](../design.md#일러스트와-캐릭터)                                                 |
| 스켈레톤·스피너     | heroui `Skeleton`·`Spinner`, `TextSkeleton`(`Omit<ComponentProps<typeof Skeleton>, …>`)                                                        | 스피너 색은 `useResolvedColor`                                                                |
| 탭·구분선·스크롤 끝 | `ViewTabs` + `LineTabTrigger`·`SegmentTabTrigger`, heroui `Accordion`, heroui `Separator` + `DashedDivider`, **`ScrollFade`**                  | 실선 구분선은 토큰 하나                                                                       |
| 이미지·비율·캐릭터  | `Image`, `FeatureMedia`, `AspectRatio`, **`Mascot`**                                                                                           | 비율을 직접 계산하지 않는다                                                                   |
| 시간 고르기         | **`TimeSpinner`** + `openAndroidTimePicker()`                                                                                                  | 설정·할 일 시간 피커를 하나로                                                                 |
| 크기 재기           | `useLayoutSize()`, Skia는 감싼 View `onLayout` → shared value(프레임마다 그리는 Canvas만 `onSize`, [ui](./ui.md#모션과-skia))                  | 재기 전은 `null`이고 첫 프레임은 어림값으로 그린다. `onLayout` → `setSize`를 직접 쓰지 않는다 |

## 새 공용 부품의 인터페이스

- **`SurfaceCard`**(있음): `Omit<ComponentProps<typeof Surface>, 'variant'>` + `surface: 'screen' | 'sheet'`. `variant="transparent"`로 그려 `SurfaceContext`를 만들지 않고, `rounded-2xl bg-gray-1` 면이다.
- **`LabelChip`**(있음): heroui `Chip` + 자식 `Text` + soft 색 매핑. 글자 크기는 칩 크기를 따른다(`sm` → `e1`, `md`·`lg` → `b3`). soft 변형만 지원하고 섹션 머리 알약(`secondary`, `b4`)과 누르는 제안 칩은 아직 옮기지 않았다. 글자 색은 [design의 주황 두 가지](../design.md#주황-두-가지)를 따른다.
- **`MenuContent`**(있음): `Menu.Portal` + `Menu.Overlay` + 앱 겉모양을 한 번에 둔 `Menu.Content` 확장이다. 항목은 `MenuActionItem`(위험하면 `variant="danger"`), 고르는 메뉴는 `Menu.Item` + `Menu.ItemIndicator`다.
- **`Checkbox`**(있음): heroui `Checkbox` 확장. 앱 체크박스 겉모양이고 `isSelected`/`onSelectedChange`를 그대로 쓴다. features에서 heroui `Checkbox`를 직접 import하지 않는다.
- **`ScrollFade`**(있음): `surface: 'screen' | 'sheet'`. 화면·시트 스크롤의 잘리는 쪽을 흐리게 덮는다(`ScreenScrollShadow`·`SheetScrollShadow`를 대신한다).
- **`Mascot`**(있음): `name`, `size?`, `isCentered`. 고양이 이미지를 직접 import하지 않는다.
- **`TimeSpinner`**(있음): `value`·`onChange`(`TimeOfDay`), `timeFormat`, `minimum`, `maximum`. iOS 휠이고 Android 시스템 피커는 `openAndroidTimePicker({ value, timeFormat })`(`Promise<TimeOfDay | null>`)다.
- **`RouteBottomSheet`**(있음): `fallbackHref`, `loading`, `children`·`footer`는 `(sheet) => ReactNode`. 대상이 있는 시트 route의 껍데기 하나(떠나기·경계·문의)이고 대상은 `useSheetTodo` 같은 route 훅으로 읽는다. 입력이 있으면 `RouteKeyboardBottomSheet`다.
- **`useOpenSheet()`**(있음): `openSheet(render, options)`. route 문맥이 없는 시트(폼에 묶인 피커)를 띄우고 고른 값을 돌려준다(취소는 `undefined`). 폼이 `footer`를 가진 입력 시트는 `useOpenKeyboardSheet()`다([overlay](../../src/shared/ui/overlay/overlay.md)).
- **`QueryErrorFallback.Inline`**(있음): 블록 안 "실패 + 다시 시도" 한 줄이다. `hasInquiry`를 켜면 문의하기가 붙는다.

## 직접 만든 부품을 둔 이유

원본으로 바꿨을 때 화면·동작이 같다고 보일 수 없으면 유지한다. heroui 업데이트가 이유를 풀면 바꾼다.

| 부품                      | 원본                                        | 유지 이유                                                                                                                                                                                                                |
| ------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Input`, `TextArea`       | `TextField`·`Input`·`TextArea`·`FieldError` | 시트 키보드 대상(gorhom `BottomSheetTextInput`이 UI 스레드에서 바꾸고 등록·정리한다. `isBottomSheetAware`는 1.0.11에 없다), `FieldError`가 자리를 잡지 않아 오류가 뜨면 아래가 밀린다, heroui `TextArea`는 높이 고정이다 |
| `PasswordInput`           | `InputGroup`                                | `InputGroup.Input`이 heroui `Input`이라 위 차이를 갖고, `Suffix`가 묶음 높이에 절대 위치라 라벨·오류 줄을 다시 만들어야 한다. `Input`과 함께 옮긴다                                                                      |
| `HintPopoverContent`      | `Popover`의 `avoidCollisions`               | heroui는 위아래를 뒤집지 않고 위치만 자른다. `getHintPlacement`는 자리가 많은 쪽으로 뒤집고, 왼쪽 폭 계산(`getHintWidth`)도 heroui에 없다                                                                                |
| `AppToast`                | `Toast.Title`·`.Description`·`.Action`      | heroui 글자가 고정 크기라 앱 글꼴 5단계를 따르지 않는다                                                                                                                                                                  |
| `ActionButton`, 누르는 칩 | heroui `Chip`                               | `Chip`은 `PressableFeedback`이 아니라 눌림 크기 변화가 사라진다                                                                                                                                                          |
| `ListRow`                 | `ListGroup.Item`                            | 제목·설명이 heroui 글꼴이고 안쪽 여백이 달라 모양이 바뀐다                                                                                                                                                               |
| 요금제 선택 카드          | heroui `Card`                               | 고른 테두리(`border-2`)가 UI 스레드에서 전환되고 `SurfaceCard`와 역할·모서리가 달라 `AnimatedCard`로 둔다(`subscription-plan-input`, 로딩 `plan-picker`)                                                                 |

- 입력의 초점·선택 색은 이제 테마([design](../design.md#테마-토큰))로 맞출 수 있어 유지 이유가 아니다. `maxLength`가 있으면 글자 수를 자동으로 보인다.

## heroui 쓰는 법

- 겹 구조를 지킨다(`Tabs.List` → `Tabs.Trigger`, `Menu.Portal` → `Menu.Content`). 다른 누름 부품에 맡길 때는 `asChild`를 쓰고 감싸는 `View`를 더하지 않는다.
- variant는 뜻으로 고른다: `primary`는 맥락마다 주 동작 하나, `secondary` 대안, `tertiary`·`ghost` 낮은 강조, `danger` 파괴 동작. `className`은 배치와 위 표에 정한 덮어쓰기만 준다.
- 글자 부품(`Chip.Label`, `Tabs.Label`, `Menu.ItemTitle`)에 날글자를 넘기지 않는다. 앱 `Text`를 자식으로 둔다. heroui 글자는 앱 글꼴 5단계를 따르지 않는다.

```tsx
<Chip size="sm" variant="soft" color="accent">
  <Text size="e1" className="text-accent-soft-foreground">
    {t('badge.new')}
  </Text>
</Chip>
```

- JS 색 문자열이 필요하면 heroui 토큰(`accent`, `muted`, `separator`)은 heroui `useThemeColor('accent')`, 앱 토큰(`main`, `gray-*`, `on-sky`)은 `useResolvedColor('text-main')`이다. 같은 일을 하는 기능 훅을 만들지 않는다.
- **Portal.** `HeroUINativeProvider`가 기본 `PortalHost`를 그리지만 Query·DI provider 바깥이다. `Popover`·`Menu` 내용 안에서 조회·DI 훅을 부르지 않고 그 부품을 두는 컴포넌트에서 읽어 넘긴다. 시트·다이얼로그의 `*.Portal`은 `usePortalTarget()`을 펼쳐 `OverlayProvider`의 호스트에 그린다.
- **Portal 안 상태.** 띄운 내용은 열 때의 클로저를 붙잡는다. 부모의 `isPending` 같은 반응형 값을 넘기면 열린 순간 값에 얼어붙는다. 진행 상태는 내용이 스스로 갖고(`mutateAsync`를 안에서 기다린다), 여는 쪽은 열 때 정해지는 값(대상, 초기값)만 넘긴다.
- Uniwind는 구체성으로 클래스를 고른다. `disabled:`처럼 variant가 붙은 기본값은 같은 variant(`disabled:opacity-40`)로만 덮인다.

## 시트

| 부품                       | 쓰임                                                                 |
| -------------------------- | -------------------------------------------------------------------- |
| `KeyboardBottomSheet`      | 입력이 있는 폼                                                       |
| `BottomSheet`              | 키보드가 필요 없는 피커·액션 시트                                    |
| `ModalBottomSheet`         | 시트 위 시트(`useOpenSheet`). 열릴 때 키보드를 스스로 내린다         |
| `RouteBottomSheet`         | 대상이 있는 시트(`transparentModal` route, id는 route 훅으로 읽는다) |
| `RouteKeyboardBottomSheet` | 입력이 있는 대상 시트 route                                          |

- 내용은 `children` 흐름에 두고, 작은 화면·큰 글자·키보드에도 보여야 할 주 버튼만 `footer`에 둔다. 시트 안에 세로 스크롤을 또 두지 않는다.
- 아래 시트 입력으로 포커스를 돌릴 때는 `onCloseStart`에서 한다. "확인"이 머리글에 있으면 `hasFixedHeader` + `SheetHeaderLayout`이다. 배치(Duo 접힘선·레일, iPad 여백)는 `getSheetLayout`이 정한다.
- 상세 계약은 `src/shared/ui/bottom-sheet/bottom-sheet.md`에 있다.

## 이름

- 원본을 확장하면 원본 이름으로 끝난다. 파일은 `{역할}-{원본}.tsx`, 컴포넌트는 `{역할}{원본}`이다(`unread-notification-card.tsx` → `UnreadNotificationCard`). 원본 이름: `Card`, `Chip`, `Popover`, `Dialog`, `Alert`, `Tabs`, `Menu`, `Avatar`, `Skeleton`, `Separator`, `Button`, `BottomSheet`.
- `*-card`는 `SurfaceCard`를 쓴다. 예외: `unread-notification-card`는 화면 톤을 지키려 heroui `Card`(`rounded-3xl`, 라이트 `shadow-surface`)를 그대로 쓴다. 목록 행은 `{역할}-row.tsx`, 동작만 주는 `PressableFeedback`은 `{역할}-button.tsx`다.
- 값을 고르는 부품(`RadioGroup`, `InputOTP`)은 `{역할}-input.tsx`이고 `value`/`onValueChange`다. 피커는 `{대상}Picker`(`TodoDatePicker`)다.
- 아이콘 prop은 둘이다. 크기·색을 부품이 정하면 `Icon: StyledIcon`(`<MenuActionItem Icon={TrashIcon} />`), 호출부가 그려 넘기면 `icon: ReactNode`(`<IconButton icon={<CloseIcon />} />`)다.

## 새 부품 추가

- `shared/ui`에는 도메인 뜻이 없는 틀만 둔다. 세 번째 쓰임이 생길 때 올리고, 그 전에는 기능 안에 두고 아이콘·토큰으로 모양을 맞춘다. 기능 장식은 공용 틀의 `icon` 슬롯에 기능이 넣는다(`IconCircle`, `Result`).
- 원본이 있으면 확장한다([ui](./ui.md#기준-컴포넌트)의 `AmountInput` 규칙).
- 같은 PR에 `src/shared/ui/{name}/{name}.tsx`, `{name}.md`, 순수 로직이 있으면 테스트, 위 역할표 한 줄을 넣는다. `{name}.md`는 이 틀을 따른다.

```text
# {Name}

역할 한두 줄. 원본 대신 이것을 쓰는 이유.

## 사용법
짧은 tsx 예 하나.

## Props
원본에 더하거나 바꾼 prop만 표로 적는다. 나머지는 `...props`(원본 Props)다.

## 동작
코드로 알 수 없는 것만: 접근성, 글꼴 단계, 다크, 키보드·safe area, 원본과 다른 점과 그 이유.
```
