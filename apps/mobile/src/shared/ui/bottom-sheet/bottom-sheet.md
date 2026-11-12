# BottomSheet

바텀시트 컴포넌트 모음. 용도에 따라 3가지 변형을 제공합니다.

## 컴포넌트 선택 가이드

| 컴포넌트              | 용도                                     | 키보드 연동 |
| --------------------- | ---------------------------------------- | ----------- |
| `KeyboardBottomSheet` | 키보드가 필요한 폼 (텍스트 입력)         | O           |
| `BottomSheet`         | 키보드 불필요 (피커, 액션시트)           | X           |
| `ModalBottomSheet`    | 시트 위에 시트 (`BottomSheet` + overlay) | X           |

## 구조

모든 시트는 HeroUI `BottomSheet` + `BottomSheet.Portal`로 그린다. 호스트는 `OverlayProvider`가 가져 Query·DI·Overlay를 그대로 쓸 수 있고,
열린 순서대로 쌓인다. 앱 기본 PortalHost는 Query·DI 바깥이라 쓰지 않는다. HeroUI `*.Portal`을 직접 쓸 때는 `usePortalTarget()`을 펼쳐 넘긴다.

- **Context:** Portal은 Context를 잇지 못한다. 시트 안에서 읽는 Context는 시트 안에 둔다. 폼은 Context 없이 `form`·`control`을 props로 넘기고, `footer`에서 읽을 때도 그렇다.
- **배경:** `BottomSheet`는 문서의 커스텀 Overlay 방식(`useBottomSheet`, `useBottomSheetAnimation`)이다. 기본 Overlay는 닫기 시작하면 바로 사라진다.
- **닫힘 알림:** `BottomSheet`의 `onOpenChange(false)`는 `useBottomSheetAnimation().progress`가 닫힌 위치에 멈춘 뒤에 온다. 문서상 gorhom `onClose`는 스와이프로 닫을 때만 오기 때문이다.

공식 방식을 그대로 쓰지 않는 곳과 이유:

| 위치                                                                     | 이유                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 포커스 입력 스크롤은 `use-scroll-focused-input-into-view`                | keyboard-controller 문서의 `BottomSheetKeyboardAwareScrollView`는 스크롤 뷰가 제자리라고 보고 키보드 시작 때의 입력 위치로 스크롤 양을 정한다. gorhom `interactive`는 시트를 키보드만큼 함께 올리므로 그 양만큼 더 스크롤된다                                                |
| `KeyboardBottomSheet`의 내용은 gorhom 직접 사용                          | `BottomSheet.Content`가 내용을 `BottomSheetView`로 감싸, 그 `onLayout`과 안쪽 `BottomSheetScrollView`가 같은 동적 높이를 번갈아 쓰고 키보드로 시트가 줄어도 안쪽 스크롤 높이가 줄지 않는다. HeroUI 문서도 스크롤 내용은 `enableDynamicSizing={false}`·고정 높이로만 안내한다 |
| `KeyboardBottomSheet`의 `useAndroidBackHandler`                          | `onDismissRequest`를 끼워 넣어야 하는데 HeroUI의 뒤로 가기 처리는 가로챌 수 없다                                                                                                                                                                                             |
| 입력은 `BottomSheetTextInput` (`useBottomSheetAwareHandlers` 아님)       | gorhom 소스가 JS에서 `.set(updater)`를 쓰면 키보드 이벤트를 놓칠 수 있다고 경고하는데 공식 훅이 그 방식이고, 언마운트 정리도 없다                                                                                                                                            |
| `footer`는 gorhom `BottomSheetFooter`를 쓰지 않음                        | gorhom footer는 매 프레임 화면에 보이는 바닥(키보드 위)에 붙어, 시트가 올라오는 동안 내용을 덮었다가 다 올라오면 비킨다. 시트 바닥에 붙여 함께 움직이고, `KeyboardBottomSheet`는 키보드에 가리는 만큼만 올린다                                                               |
| `BottomSheet`가 `useBottomSheetInternal`의 `animatedDetentsState`를 읽음 | route처럼 열린 채 마운트하면 gorhom이 높이 측정 전의 열기를 버리는데, 측정 끝을 알리는 공개 이벤트가 없다. HeroUI 시트 내용도 같은 값을 읽는다                                                                                                                               |

## 사용법

### BottomSheet

```tsx
import { BottomSheet } from '@src/shared/ui';

<BottomSheet isOpen={isOpen} onOpenChange={setIsOpen}>
  {/* 피커, 액션시트 등 */}
</BottomSheet>;
```

내용이 시트 최대 높이보다 길면 시트 안에서 스크롤한다. 작은 화면(SE·Duo 바깥 화면)·큰 글자에서도 주 동작 버튼이
보여야 하면 `footer`에 두어 시트 아래에 고정한다.

```tsx
<BottomSheet isOpen={isOpen} onOpenChange={setIsOpen} footer={<Button>확인</Button>}>
  {/* 긴 안내 */}
</BottomSheet>
```

### KeyboardBottomSheet

내용은 스크롤된다. 짧으면 시트가 그 높이로 줄어들지만, 키보드가 올라온 채로 내용이
길어지면 아래쪽 버튼에 손이 닿지 않기 때문이다. 그래서 시트 안에 세로 스크롤 컨테이너를
또 두면 안 된다. 가로로 미는 칩 줄은 `SheetChipRow`를 쓴다.

```tsx
import { KeyboardBottomSheet } from '@src/shared/ui';

<KeyboardBottomSheet isOpen={isOpen} onOpenChange={setIsOpen}>
  {/* 텍스트 입력 폼 */}
</KeyboardBottomSheet>;
```

내용이 안쪽 스크롤을 직접 두면(빠른 말하기 자막) `enableContentPanningGesture={false}`로 내용을 끌어도 시트가 움직이지 않게 하고 손잡이로만
움직이게 한다. 높이는 `useKeyboardSheetBodyMaxHeight()`를 넘지 않게 고정한다. 시트 테두리에 맞물리는 장식은 `backgroundDecoration`으로
시트 면 뒤에 깐다. 내용 제스처를 꺼도 시트 면을 탭하면 뒤 backdrop까지 내려가지 않는다(시트 면이 터치를 받는다).

`SheetChipRow`는 칩을 한 줄로 두고 시트 좌우 끝까지 가로로 민다. gorhom 문제 해결 문서대로 Gesture Handler `ScrollView`를 쓰고,
시트 끌기는 gorhom `activeOffsetY`(세로 15dp)·`failOffsetX`(가로 10dp)로 세로로 움직일 때만 잡는다. Gesture Handler
`ScrollView`만으로는 Android에서 손가락이 조금만 흔들려도 시트가 끌기를 가져가 칩 줄이 밀리지 않았다. 고른 칩은
`getChipRevealScrollX`로 다 보일 만큼만 민다(낮은 창의 카테고리 색). 누른 칩이 이미 다 보이면 줄을 밀지 않는다.

바깥 탭과 Android 뒤로 가기에서 닫기 전에 할 일이 있으면(빠른 말하기의 듣기 취소·계획 버리기 확인) `onDismissRequest`를 넘긴다. 없으면 닫는다.
손잡이·내용 끌어내리기는 gorhom이 닫으므로 이 경로를 타지 않는다. 핸들러는 ref로 읽어 렌더마다 바뀌어도 backdrop이 다시 마운트되지 않는다.

내용과 `footer`를 나누는 규칙은 [시트 규칙](../../../../docs/architecture/ui-catalog.md)을 따른다. 키보드 위에 남는 높이는 기기마다
달라(접은 Duo는 키보드 위 374pt) `footer`를 쓰는 키보드 시트는 카테고리 만들기·고치기, 콕 찌르기, 계획 할 일
고치기, 신고다. `footer`는 시트 바닥에 붙어 시트와 함께 올라오고, 시트가 위쪽 한계에 닿아 키보드에 가리는
만큼만 올라가 키보드 위에 멈춘다. 위쪽 한계는 쉬는 시트와 다르다. 쉬는 시트는 레일 상태 표시(occlusion) 아래에 두지만 키보드가
올린 시트는 위쪽 safe area까지 내용 높이만큼 올라간다(`getKeyboardSheetTopInset`). 접은 Duo는 상태 표시 아래(170pt)와 키보드 위
사이가 204pt라 카테고리 이름 칸·색·확인(309pt)이 함께 들어가지 않았다. 시트 면은 레일까지 덮지만 내용과 `footer`는 시트가 덮은 가로 safe area만큼 더 들여(`getKeyboardSheetContentPadding`,
접은 Duo 오른쪽 84) 시트가 상태 표시 위로 올라가도 입력·버튼이 그 밑에 들지 않는다. 첫 높이는 그리기 전에 동기로 재어(New Architecture `useLayoutEffect` + `measure`) 내용 아래
여백과 시트 높이에 처음부터 들어간다. gorhom은 키보드가 올라와도 내용 영역을 줄이지 않으므로, 시트가 위쪽 한계에 닿으면 스크롤 영역
아래 끝을 키보드 위로 맞춘다. 그래서 `footer` 뒤로 들어간 내용(카테고리 색)도 `footer` 위까지 스크롤되고, 키보드가 다 올라오면
스크롤 막대를 잠깐 보여 아래 내용이 있음을 알린다. 시트를 끌어내리면 gorhom이 키보드를 내린다.

입력에 포커스해 키보드가 올라오면 시트가 포커스된 입력 칸 전체(라벨·테두리·오류 문구)를 `footer`·키보드 위로
스크롤한다. `Input`·`TextArea`가 포커스될 때 칸 전체 뷰를 `FocusedFieldContext`로 알리고, 알리지 않는 입력은 안쪽 TextInput에
라벨·테두리 몫을 더해 잰다. `footer` 높이가 키보드가 올라온 뒤에 바뀌면 다시 맞춘다. 키보드가 다 올라온 뒤의 배치를 미리 구해 시트가 키보드를 따라 움직이는 프레임마다 UI 스레드에서 맞추므로
키보드·시트·스크롤이 한 동작으로 움직인다. 보이는 높이가 라벨까지 담기엔 좁으면(접은 Duo·SE) 입력 칸 전체가 버튼 위에
오는 쪽을 우선한다. 시트가 위쪽 한계까지 올라가 높이가 모자랄 때만 `footer` 아래 safe area 여백을 줄인다.

```tsx
<KeyboardBottomSheet isOpen={isOpen} onOpenChange={setIsOpen} footer={<Button>신고하기</Button>}>
  {/* 사유 선택·상세 입력 */}
</KeyboardBottomSheet>
```

### ModalBottomSheet

기존 시트 위에 추가 시트를 띄울 때 `useOverlay`와 함께 쓴다. 키보드는 열릴 때 이 시트가 내리므로 호출부에서 `Keyboard.dismiss()`를 부르지 않는다. 같은 호스트에 나중에 등록되어 아래 시트 위에 쌓인다. 아래 시트의 입력에 다시 포커스할 때는 `onExit`가 아니라 `onCloseStart`에서 해서, 위 시트가 내려가는 동안 키보드와 아래 시트가 함께 올라오게 합니다.

```tsx
import { ModalBottomSheet } from '@src/shared/ui';

// useOverlay 등으로 isOpen/onOpenChange/onExit를 관리
<ModalBottomSheet isOpen={isOpen} onOpenChange={handleOpenChange} onExit={handleExit}>
  {/* 피커 내용 */}
</ModalBottomSheet>;
```

내용은 시트 안에서 스크롤된다. 글자 크기를 키우거나 작은 화면에서 내용이 넘쳐도 주 동작 버튼이 밀려나지 않게
`footer`에 두면 스크롤 영역 아래에 고정된다. 시트 안에 세로 스크롤 컨테이너를 또 두지 않는다.

```tsx
<ModalBottomSheet
  isOpen={isOpen}
  onOpenChange={handleOpenChange}
  onExit={handleExit}
  footer={<Button onPress={handleConfirm}>확인</Button>}
>
  {/* 긴 안내 */}
</ModalBottomSheet>
```

내용이 넘치면 스크롤 막대와 heroui-native `ScrollShadow` 흐림이 나타나 더 있다는 걸 알린다. 넘치지 않으면 평소 모양 그대로다.

### 머리글 고정 (`hasFixedHeader`, `SheetHeaderLayout`)

날짜·시간·반복 피커처럼 "확인"이 머리글에 있는 시트는 스크롤해도 머리글이 남아야 한다. 머리글이 내용 쪽 폼 상태를 읽으므로
`footer`처럼 시트에 넘기지 않고, `hasFixedHeader`를 주고 내용이 `SheetHeaderLayout`을 쓴다. 같은 내용을
`hasFixedHeader` 없는 `BottomSheet`(할 일 메뉴의 날짜·시간 route)에 넣으면 머리글과 본문을 쌓기만 하고 시트 전체가 스크롤한다. 반복 기간처럼 늘 보여야 하는 아래 줄은
`footer`로 넘기면 본문 아래에 함께 고정된다.

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

할 일·하위 항목·카테고리·제안처럼 대상이 있는 시트는 Overlay 대신 Expo Router route로 띄운다.
대상 id는 폴더 구조(`app/(app)/todo/[todoId]/actions.tsx`)에서 오고, 시트는 route hook으로 읽어
Query 캐시에서 데이터를 조회하고 mutation을 직접 가진다. 화면 등장·퇴장은 시트가 그대로
맡으므로 키보드 연동과 UI thread 애니메이션은 Overlay 시트와 같다.

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

- Stack 레이아웃에 `SHEET_ROUTE_SCREEN_OPTIONS`(`transparentModal`, `animation: 'none'`, 투명 배경)로 등록한다.
- `sheet.close(next?)`는 닫기 애니메이션을 시작하고, 애니메이션이 끝나 `onOpenChange(false)`가 오면 route를
  한 번만 떠난다. 기본은 `router.back()`이고 돌아갈 화면이 없으면(콜드 딥링크) fallback으로 `replace`한다.
- 다음 시트로 이어질 때는 `close({ type: 'replace', href })`로 바꿔 뒤로가기 기록을 쌓지 않는다.
  완료 후 아래 화면도 바꿔야 하면 `close({ type: 'back-then-replace', href })`를 쓴다.
- 구독 화면 이동처럼 애니메이션 없이 바로 떠날 때는 `sheet.exit()`를 쓴다.
- Android 뒤로가기는 `BottomSheet`는 HeroUI가, `KeyboardBottomSheet`는 `useAndroidBackHandler`가 먼저 소비해 닫기 애니메이션 뒤 route를 떠난다.
- `SheetRouteScreen`은 제스처 루트와 `OverlayProvider`를 route 안에 다시 둔다. iOS transparentModal은 루트 위에
  따로 표시되므로, 시트와 그 위의 피커·다이얼로그가 이 모달 안에 그려지게 하기 위해서다. 호스트가 route 안에 있어 route 훅도 그대로 쓴다.
- 이 호스트는 `disableFullWindowOverlay`다. iOS FullWindowOverlay는 모달 바깥 창에 붙어 화면에는 보여도 VoiceOver·XCUITest가 읽지 못한다.

## Props

### BottomSheet

| Prop             | 타입                        | 기본값  | 설명                                                    |
| ---------------- | --------------------------- | ------- | ------------------------------------------------------- |
| `isOpen`         | `boolean`                   | -       | 시트 열림 상태                                          |
| `onOpenChange`   | `(isOpen: boolean) => void` | -       | 열림/닫힘 상태 변경 콜백                                |
| `onCloseStart`   | `() => void`                | -       | 닫기 시작 시 콜백 (선택)                                |
| `children`       | `ReactNode`                 | -       | 시트 내용                                               |
| `footer`         | `ReactNode`                 | -       | 시트 아래 고정 영역 (선택)                              |
| `hasFixedHeader` | `boolean`                   | `false` | 내용이 `SheetHeaderLayout`으로 머리글을 고정한다 (선택) |

### KeyboardBottomSheet

| Prop                          | 타입                        | 기본값 | 설명                                                      |
| ----------------------------- | --------------------------- | ------ | --------------------------------------------------------- |
| `isOpen`                      | `boolean`                   | -      | 시트 열림 상태                                            |
| `onOpenChange`                | `(isOpen: boolean) => void` | -      | 닫힘이 끝나면 `false`로 호출                              |
| `onCloseStart`                | `() => void`                | -      | 닫기 시작 시 콜백 (선택)                                  |
| `children`                    | `ReactNode`                 | -      | 시트 내용                                                 |
| `footer`                      | `ReactNode`                 | -      | 시트 아래(키보드 위) 고정 영역 (선택)                     |
| `backgroundDecoration`        | `ReactNode`                 | -      | 시트 면 뒤에 까는 장식 (선택)                             |
| `enableContentPanningGesture` | `boolean`                   | `true` | 내용을 끌어 시트를 움직일지 (gorhom 이름, 선택)           |
| `onDismissRequest`            | `() => void`                | -      | 바깥 탭·Android 뒤로 가기에서 할 일. 없으면 닫는다 (선택) |

### ModalBottomSheet

| Prop             | 타입                        | 기본값  | 설명                                                          |
| ---------------- | --------------------------- | ------- | ------------------------------------------------------------- |
| `isOpen`         | `boolean`                   | -       | 시트 열림 상태                                                |
| `onOpenChange`   | `(isOpen: boolean) => void` | -       | 닫기 시작(backdrop tap, swipe, 뒤로가기) 시 `false`로 호출    |
| `onCloseStart`   | `() => void`                | -       | `onOpenChange`보다 먼저 호출. 아래 시트 입력 포커스 등 (선택) |
| `onExit`         | `() => void`                | -       | 닫기 애니메이션 완료 후 호출 → 컴포넌트 언마운트 트리거       |
| `children`       | `ReactNode`                 | -       | 시트 내용                                                     |
| `footer`         | `ReactNode`                 | -       | 스크롤 영역 아래에 고정되는 영역 (주 동작 버튼, 선택)         |
| `hasFixedHeader` | `boolean`                   | `false` | 내용이 `SheetHeaderLayout`으로 머리글을 고정한다 (선택)       |

## 파일 구조

```
bottom-sheet/
├── bottom-sheet.tsx                   # HeroUI 기반 기본 바텀시트
├── keyboard-bottom-sheet.tsx          # HeroUI Root·Portal + gorhom 내용의 키보드 연동 바텀시트
├── keyboard-bottom-sheet.geometry.ts  # 키보드 시트 최대 높이, 키보드에 가린 높이, 키보드 위 내용 높이(순수)
├── modal-bottom-sheet.tsx             # overlay로 띄우는 바텀시트 (시트 위 시트)
├── portal-target.ts                   # HeroUI *.Portal에 넘길 호스트
├── sheet-footer-slot.tsx              # footer가 바뀌어도 다시 마운트되지 않고, 첫 높이를 그리기 전에 재는 슬롯
├── sheet-header-layout.tsx            # 머리글 고정 + 본문 스크롤 (hasFixedHeader 시트의 내용)
├── sheet-scroll-view.tsx              # 넘칠 때 스크롤 막대·`ScrollFade` 흐림을 보이는 시트 스크롤
├── sheet-route.ts                     # 시트 route Stack 옵션과 route 떠나기 규칙
├── sheet-route-screen.tsx             # 시트 route 화면 바탕 (제스처 루트 + 크기 확정 대기 + Overlay)
├── use-sheet-route.ts                 # 시트 route의 열림 상태와 한 번만 떠나기
├── use-android-sheet-back-handler.ts  # 열린 시트의 시스템 뒤로가기 구독과 정리
├── use-scroll-focused-input-into-view.ts # 키보드와 함께 포커스된 입력까지 시트 내용을 스크롤
├── get-focused-input-scroll-offset.ts # 키보드가 다 올라온 뒤의 배치와 스크롤 위치 계산
├── get-sheet-horizontal-margins.ts    # 주어진 영역 기준 최대 폭·가운데 정렬 여백
├── get-sheet-layout.ts                # reserved region·safe area로 좌우 여백, 위쪽 한계, 최대 높이 계산
├── use-sheet-layout.ts                # 위 계산에 창 크기·safe area·reserved region을 넣는 훅
├── bottom-sheet.constants.ts          # 공유 스타일, 상수
├── index.ts                           # barrel export
└── bottom-sheet.md                    # 이 문서
```

## 배치 (iPhone Duo·폴더블)

[Expo의 iPhone Duo 가이드](https://expo.dev/blog/supporting-iphone-duo)대로 피할 영역을 정한다.
배치 기하는 `react-native-reserved-regions`가 잰 값만 쓰고 직접 추정하지 않는다.

시트는 모두 Portal로 전체 창에 그려져 레일을 덮으므로 좌우 대칭으로 채운다. 세로 접힘선이 있으면 더 넓은 면에만 두고,
위쪽 한계는 위쪽 safe area와 겹치는 occlusion(레일의 상태 표시) 중 아래쪽이다. 키보드가 올린 `KeyboardBottomSheet`만 위쪽 safe area까지 간다.

최대 높이는 위쪽 한계와 아래 여백 사이(`getSheetMaxHeight`)이고, 내용이 더 길면 시트 안에서 스크롤한다.
route 시트는 모달이 크기를 받은 뒤 그려서, 시트에서 시트로 replace할 때 크기가 정해지기 전 위치로 열리지 않게 한다.

## Android 뒤로가기와 정리 (1.11.0)

열린 시트가 시스템 뒤로가기를 소비한다. `BottomSheet`·`ModalBottomSheet`는 HeroUI가, `KeyboardBottomSheet`는
`useAndroidBackHandler`가 처리한다. 가장 마지막에 열린 시트가 먼저 닫히며, 닫힘 이후에는 기존 Expo Router 화면 뒤로가기가 이어진다.
React Native `BackHandler`의 구독은 cleanup에서 제거한다.

`KeyboardBottomSheet`의 내용 크기·키보드 변경은 하나의 예약 resize frame으로 모은다.
시트가 닫히거나 unmount되면 frame을 취소하고, forceClose 재시도 timer도 정리한다.
키보드 시트의 index·최소 높이·상단 여백은 `bottom-sheet.constants.ts`를 재사용한다.

전역 `OverlayProvider`의 선택적 `resetKey`에는 bootstrap에서 `usePathname()`을 전달한다.
푸시·딥링크 등으로 실제 화면 경로가 바뀌면 이전 오버레이가 새 화면 위에 남지 않는다.
검색 파라미터만 변경하는 탭·날짜 선택은 pathname이 같으므로 현재 시트를 임의로 닫지 않는다.

- [React Native BackHandler](https://reactnative.dev/docs/backhandler)
- [React useEffectEvent: listener와 최신 callback](https://react.dev/reference/react/useEffectEvent)
- [Expo Router navigation](https://docs.expo.dev/router/basics/navigation/)

## 열고 닫는 시간

모든 시트는 `SHEET_ANIMATION_DURATION_MS`(250ms)으로 움직인다. gorhom 기본값은 iOS만 스프링이라 닫힘 콜백이 약 680ms 뒤에 와서, 그동안 route 시트의 투명 모달이 탭을 막았다. `ModalBottomSheet`도 `BottomSheet`라 같다.
