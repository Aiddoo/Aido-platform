# BottomSheet

HeroUI `BottomSheet`(heroui-native 1.1.1, 네이티브 시트 `@lodev09/react-native-true-sheet`) 위에 Aido의 `isOpen`·footer·route 규칙을 얹은 시트 묶음이다(`BottomSheet`, `KeyboardBottomSheet`, `ModalBottomSheet`, 시트 route). 어느 것을 고르는지는 [ui-catalog §시트](../../../../docs/architecture/ui-catalog.md#시트)에 있다.

## 구조

모든 시트는 iOS 시트 표시 컨트롤러·Android 네이티브 bottom sheet로 뜬다. 끌기·딤·키보드·Android 뒤로 가기·겹친 시트는 네이티브가 맡고, 앱은 HeroUI 문서대로 ref(`present`·`dismiss`)와 이벤트만 쓴다. TrueSheet는 HeroUI를 거쳐서만 쓴다.

- **열고 닫기:** HeroUI 시트는 ref로 연다. `useSheetPresentation`이 `isOpen`을 `present()`·`dismiss()`로 잇는 한 곳이다. 열기가 끝나기 전에 닫으면 TrueSheet가 열기를 취소하고 닫힘 이벤트를 보내지 않아, 열기를 기다린 뒤 닫는다.
- **닫힘 알림:** `onCloseStart`는 `onWillDismiss`, `onOpenChange(false)`는 `onDidDismiss`(애니메이션이 끝난 뒤)다. 어떻게 닫혔든 한 번 온다. 열기가 실패하면 `bottom_sheet`로 보고하고 닫힌 것으로 알려 route 시트의 투명한 화면이 터치를 막지 않는다.
- **Context:** 시트 내용은 같은 React 트리에 그려져 주변 Context를 그대로 읽는다.
- **스크롤:** 내용 스크롤은 시트의 `scrollableRef`에 붙인다. 시트가 이 스크롤로 끌기·안쪽 스크롤·키보드 inset·`auto` 높이를 맞춘다. 시트 안에 세로 스크롤 컨테이너를 또 두지 않는다.
- **면:** `useSheetSurface`가 모든 시트에 같은 면 색(`bg-white dark:bg-gray-1`)·모서리(`SHEET_RADIUS`)·손잡이(36×4, `bg-gray-4`, `adaptive: false`)를 준다. iOS 26.1+는 `backgroundColor`를 Liquid Glass 위 색 효과로만 칠하므로 같은 색을 `backgroundStyle`로도 깔아 정확한 면 색을 보인다.
- **위에 뜨는 것:** HeroUI `Dialog`·`Toast`·`Popover`는 떠 있는 시트 위의 네이티브 층(`TrueSheetOverlay`)에 그려진다. 시트 안 뷰의 `measure`는 시트가 뜬 자리가 아니라 React 트리 속 시트 자리 기준이라, 시트가 `SheetScreenPositionProvider`로 화면 좌표 변환을 주고 `HintPopoverContent`가 대상 자리(`setTriggerPosition`)를 고친다.

## 사용법

### BottomSheet

```tsx
import { BottomSheet } from '@src/shared/ui';

<BottomSheet isOpen={isOpen} onOpenChange={setIsOpen}>
  {/* 피커, 액션시트 등 */}
</BottomSheet>;
```

시트는 내용 높이(`auto`)로 뜨고, 더 길면 시트 안에서 스크롤한다. 작은 화면(SE·Duo 바깥 화면)·큰 글자에서도 주 동작 버튼이 보여야 하면 `footer`에 두어 시트 아래에 고정한다(HeroUI sticky `BottomSheet.Footer`).

```tsx
<BottomSheet isOpen={isOpen} onOpenChange={setIsOpen} footer={<Button>확인</Button>}>
  {/* 긴 안내 */}
</BottomSheet>
```

### KeyboardBottomSheet

입력이 있는 시트다. 키보드는 네이티브 시트가 따라간다: 포커스한 입력을 오류 문구 한 줄 간격까지 키보드·`footer` 위로 스크롤하고, `footer`는 absolute라 키보드 바로 위에 붙는다. 내용 스크롤은 `keyboardShouldPersistTaps="always"`라 키보드가 열린 채 첫 탭에 버튼이 눌린다. 가로로 미는 칩 줄은 `SheetChipRow`를 쓴다.

```tsx
import { KeyboardBottomSheet } from '@src/shared/ui';

<KeyboardBottomSheet isOpen={isOpen} onOpenChange={setIsOpen} footer={<Button>신고하기</Button>}>
  {/* 사유 선택·상세 입력 */}
</KeyboardBottomSheet>;
```

- 내용과 `footer`를 나누는 규칙은 [시트 규칙](../../../../docs/architecture/ui-catalog.md#시트)을 따른다. `footer`를 쓰는 키보드 시트는 카테고리 만들기·고치기, 콕 찌르기, 계획 할 일 고치기, 신고다.
- 내용이 안쪽 스크롤을 직접 두면(빠른 말하기 자막) `isDraggable={false}`로 시트를 끌어 움직이지 않게 하고, 높이는 `useKeyboardSheetBodyMaxHeight()`를 넘지 않게 고정한다. 시트 면 위·내용 뒤의 장식은 `backgroundDecoration`이다(시트 밖은 네이티브 시트가 잘라 그리지 않는다).
- 닫기 전에 할 일이 있으면(빠른 말하기의 듣기 취소·계획 버리기 확인) `onDismissRequest`를 넘긴다. 그러면 시트가 스스로 닫히지 않고(`dismissible={false}`) 끌어내림·Android 뒤로 가기가 이 핸들러로 온다. 바깥 탭은 네이티브가 알리지 않아 아무 일도 없다. 넘기지 않으면 그대로 닫힌다.
- 열린 동안 화면용 `react-native-keyboard-controller`를 끈다. 전역이라 마지막으로 닫히는 시트만 다시 켠다.

### ModalBottomSheet

기존 시트 위에 추가 시트를 띄울 때 `useOverlay`와 함께 쓴다. 네이티브가 아래 시트 위에 쌓는다. 키보드는 열릴 때 이 시트가 내리므로 호출부에서 `Keyboard.dismiss()`를 부르지 않는다. 아래 시트의 입력에 다시 포커스할 때는 `onExit`가 아니라 `onCloseStart`에서 해서, 위 시트가 내려가는 동안 키보드와 아래 시트가 함께 올라오게 합니다.

```tsx
import { ModalBottomSheet } from '@src/shared/ui';

// useOverlay 등으로 isOpen/onOpenChange/onExit를 관리
<ModalBottomSheet
  isOpen={isOpen}
  onOpenChange={handleOpenChange}
  onExit={handleExit}
  footer={<Button onPress={handleConfirm}>확인</Button>}
>
  {/* 피커 내용 */}
</ModalBottomSheet>;
```

### 머리글 고정 (`hasFixedHeader`, `SheetHeaderLayout`)

날짜·시간·반복 피커처럼 "확인"이 머리글에 있는 시트는 스크롤해도 머리글이 남아야 한다. 머리글이 내용 쪽 폼 상태를 읽으므로 `footer`처럼 시트에 넘기지 않고, `hasFixedHeader`를 주고 내용이 `SheetHeaderLayout`을 쓴다. 시트는 본문 스크롤을 `SheetFixedHeaderContext`로 넘겨 `scrollableRef`로 잇는다. 같은 내용을 `hasFixedHeader` 없는 `BottomSheet`(할 일 메뉴의 날짜·시간 route)에 넣으면 머리글과 본문을 쌓기만 하고 시트 전체가 스크롤한다. 반복 기간처럼 늘 보여야 하는 아래 줄은 `footer`로 넘기면 본문 아래에 함께 고정된다. 본문이 넘치면 스크롤 막대와 heroui-native `ScrollShadow` 흐림이 나타난다.

```tsx
<ModalBottomSheet
  hasFixedHeader
  isOpen={isOpen}
  onOpenChange={handleOpenChange}
  onExit={handleExit}
>
  <SheetHeaderLayout gap={20} header={<PickerTitleBar {...headerProps} />}>
    {/* 달력 등 스크롤될 본문 */}
  </SheetHeaderLayout>
</ModalBottomSheet>
```

### 시트 route (`SheetRouteScreen`, `useSheetRoute`)

할 일·하위 항목·카테고리·제안처럼 대상이 있는 시트는 Overlay 대신 Expo Router route로 띄운다. 대상 id는 폴더 구조(`app/(app)/todo/[todoId]/actions.tsx`)에서 오고, 시트는 route hook으로 읽어 Query 캐시에서 데이터를 조회하고 mutation을 직접 가진다. 화면 등장·퇴장은 네이티브 시트가 맡는다.

```tsx
// app/(app)/todo/[todoId]/actions.tsx
export default function TodoActionsSheetRoute() {
  return (
    <SheetRouteScreen>
      <TodoActionsBottomSheet />
    </SheetRouteScreen>
  );
}

// 시트: 껍데기는 RouteBottomSheet 하나다(../route-bottom-sheet/route-bottom-sheet.md)
<RouteBottomSheet fallbackHref="/feed" loading={<TodoActionsBottomSheet.Loading />}>
  {(sheet) => <TodoActionsBottomSheet.ActionList onClose={sheet.close} />}
</RouteBottomSheet>;
```

- Stack 레이아웃에 `SHEET_ROUTE_SCREEN_OPTIONS`(`transparentModal`, `animation: 'none'`, 투명 배경)로 등록한다. TrueSheet의 Expo Router `Sheet` 레이아웃으로 옮기는 것은 route 구조가 바뀌는 일이라 하지 않았다.
- `sheet.close(next?)`는 닫기 애니메이션을 시작하고, 애니메이션이 끝나 `onOpenChange(false)`가 오면 route를 한 번만 떠난다. 기본은 `router.back()`이고 돌아갈 화면이 없으면(콜드 딥링크) fallback으로 `replace`한다.
- 다음 시트로 이어질 때는 `close({ type: 'replace', href })`로 바꿔 뒤로가기 기록을 쌓지 않는다. 탭 화면(피드·문의)으로 떠날 때는 `close({ type: 'dismiss-to', href })`다. 시트와 그 아래 탭 위 화면을 닫고 탭 묶음 하나 안, 시트 아래 보던 탭에서 연다(`dismissToTab`). 탭 화면으로 `replace`하면 탭 묶음이 두 겹 쌓인다.
- 구독 화면 이동처럼 애니메이션 없이 바로 떠날 때는 `sheet.exit()`를 쓴다.
- `SheetRouteScreen`은 제스처 루트와 `OverlayProvider`·토스트 면을 route 안에 다시 둔다. iOS transparentModal은 루트 위에 따로 표시되므로, 그 위의 피커·다이얼로그가 이 모달 안의 Query·DI를 쓰게 하기 위해서다. 이 호스트는 `disableFullWindowOverlay`다. iOS FullWindowOverlay는 모달 바깥 창에 붙어 화면에는 보여도 VoiceOver·XCUITest가 읽지 못한다.

## Props

더하거나 뜻이 다른 것만 적는다.

| Prop                   | 받는 시트                        | 뜻                                                                                                      |
| ---------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `isOpen`               | 모두                             | `true`면 `present()`, `false`면 열기를 기다린 뒤 `dismiss()`                                            |
| `onOpenChange`         | 모두                             | `false`는 닫힘 애니메이션이 끝난 뒤에 온다. `ModalBottomSheet`는 닫기 시작(바깥 탭·끌기·뒤로 가기) 때다 |
| `onCloseStart`         | 모두                             | `onOpenChange`보다 먼저(`onWillDismiss`). 아래 시트 입력에 다시 포커스할 때 쓴다                        |
| `footer`               | 모두                             | 시트 아래(키보드 시트는 키보드 위)에 고정하는 주 동작                                                   |
| `hasFixedHeader`       | `BottomSheet`·`ModalBottomSheet` | 내용이 `SheetHeaderLayout`으로 머리글을 고정한다(기본 `false`)                                          |
| `onExit`               | `ModalBottomSheet`               | 닫기 애니메이션이 끝난 뒤. 부른 쪽이 언마운트한다                                                       |
| `backgroundDecoration` | `KeyboardBottomSheet`            | 시트 면 위·내용 뒤에 까는 장식                                                                          |
| `isDraggable`          | `KeyboardBottomSheet`            | 시트를 끌어 움직일지(기본 `true`)                                                                       |
| `onDismissRequest`     | `KeyboardBottomSheet`            | 끌어내림·Android 뒤로 가기에서 할 일. 넘기면 시트가 스스로 닫히지 않는다                                |

## 배치·뒤로 가기·정리

- 폭·위치·최대 높이·safe area·Android 손잡이 자리는 네이티브 시트와 HeroUI `BottomSheet.Content`가 정한다. 앱 기하로 다시 계산하지 않는다(iPhone Duo의 레일·접힘선은 기기 QA로 확인한다).
- Android 뒤로 가기는 가장 위 시트가 먼저 받는다. 그다음 Expo Router 뒤로 가기가 이어진다.
- 루트 `OverlayProvider`의 `resetKey`는 `usePathname()`이다. 푸시·딥링크로 경로가 바뀌면 떠 있던 시트를 걷고, 검색 파라미터만 바뀌는 탭·날짜 선택에서는 닫지 않는다.

## 테스트

`jest.setup.ts`가 `@lodev09/react-native-true-sheet`를 공식 mock으로, `/reanimated`를 `src/testing/mocks/react-native-true-sheet-reanimated.tsx`로 바꾼다. 이 mock은 `present`·`dismiss`에 생명주기 이벤트를 보내고, 사용자가 끌어 내리는 것은 `startDismissingTopSheet()`(닫기 시작)·`dismissTopSheetByUser()`(닫기)로 흉내 낸다.
