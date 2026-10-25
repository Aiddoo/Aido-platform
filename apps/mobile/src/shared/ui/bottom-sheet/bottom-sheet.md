# BottomSheet

바텀시트 컴포넌트 모음. 용도에 따라 3가지 변형을 제공합니다.

## 컴포넌트 선택 가이드

| 컴포넌트              | 용도                                    | 키보드 연동 |
| --------------------- | --------------------------------------- | ----------- |
| `KeyboardBottomSheet` | 키보드가 필요한 폼 (텍스트 입력)        | O           |
| `BottomSheet`         | 키보드 불필요 (피커, 액션시트)          | X           |
| `ModalBottomSheet`    | 시트 위에 시트 (Overlay 절대 위치 기반) | X           |

## 사용법

### BottomSheet

```tsx
import { BottomSheet } from '@src/shared/ui/bottom-sheet';

<BottomSheet isOpen={isOpen} onOpenChange={setIsOpen}>
  {/* 피커, 액션시트 등 */}
</BottomSheet>;
```

### KeyboardBottomSheet

내용은 스크롤된다. 짧으면 시트가 그 높이로 줄어들지만, 키보드가 올라온 채로 내용이
길어지면 아래쪽 버튼에 손이 닿지 않기 때문이다. 그래서 시트 안에 세로 스크롤 컨테이너를
또 두면 안 된다 (가로 스크롤은 무방하다).

```tsx
import { KeyboardBottomSheet } from '@src/shared/ui/bottom-sheet';

<KeyboardBottomSheet isOpen={isOpen} onOpenChange={setIsOpen}>
  {/* 텍스트 입력 폼 */}
</KeyboardBottomSheet>;
```

### ModalBottomSheet

기존 BottomSheet 위에 추가 시트를 띄울 때 사용합니다. 드래그 닫기는 상단 손잡이에서 동작하여 내부 목록 스크롤과 경쟁하지 않습니다. 시스템 Reduce Motion 설정을 Reanimated `ReduceMotion.System`으로 따릅니다. `OverlayProvider` 안에서 절대 위치 뷰로 렌더링하여 gorhom BottomSheet 위에 쌓고 Android navigation bar 충돌을 피합니다.

```tsx
import { ModalBottomSheet } from '@src/shared/ui/bottom-sheet';

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

### 시트 route (`SheetRouteScreen`, `useSheetRoute`)

할 일·하위 항목·카테고리·제안처럼 대상이 있는 시트는 Overlay 대신 Expo Router route로 띄운다.
대상 id는 폴더 구조(`app/(app)/todo/[todoId]/actions.tsx`)에서 오고, 시트는 route hook으로 읽어
Query 캐시에서 데이터를 조회하고 mutation을 직접 가진다. 화면 등장·퇴장은 기존 gorhom 시트가 그대로
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

// 시트
const sheet = useSheetRoute('/feed');
<BottomSheet isOpen={sheet.isOpen} onOpenChange={sheet.onOpenChange}>
  …
</BottomSheet>;
```

- Stack 레이아웃에 `SHEET_ROUTE_SCREEN_OPTIONS`(`transparentModal`, `animation: 'none'`, 투명 배경)로 등록한다.
- `sheet.close(next?)`는 닫기 애니메이션을 시작하고, 애니메이션이 끝나 `onOpenChange(false)`가 오면 route를
  한 번만 떠난다. 기본은 `router.back()`이고 돌아갈 화면이 없으면(콜드 딥링크) fallback으로 `replace`한다.
- 다음 시트로 이어질 때는 `close({ type: 'replace', href })`로 바꿔 뒤로가기 기록을 쌓지 않는다.
  완료 후 아래 화면도 바꿔야 하면 `close({ type: 'back-then-replace', href })`를 쓴다.
- 구독 화면 이동처럼 애니메이션 없이 바로 떠날 때는 `sheet.exit()`를 쓴다.
- Android 뒤로가기는 시트의 `useAndroidSheetBackHandler`가 먼저 소비해 닫기 애니메이션 뒤 route를 떠난다.
- `SheetRouteScreen`은 제스처 루트와 Overlay를 route 안에 다시 둔다. iOS transparentModal은 루트 위에
  따로 표시되므로, 시트 안에서 여는 피커·다이얼로그가 시트 아래로 숨지 않게 하기 위해서다.

## Props

### BottomSheet

| Prop           | 타입                        | 기본값 | 설명                     |
| -------------- | --------------------------- | ------ | ------------------------ |
| `isOpen`       | `boolean`                   | -      | 시트 열림 상태           |
| `onOpenChange` | `(isOpen: boolean) => void` | -      | 열림/닫힘 상태 변경 콜백 |
| `onCloseStart` | `() => void`                | -      | 닫기 시작 시 콜백 (선택) |
| `children`     | `ReactNode`                 | -      | 시트 내용                |

### ModalBottomSheet

| Prop           | 타입                        | 기본값 | 설명                                                       |
| -------------- | --------------------------- | ------ | ---------------------------------------------------------- |
| `isOpen`       | `boolean`                   | -      | 시트 열림 상태                                             |
| `onOpenChange` | `(isOpen: boolean) => void` | -      | 닫기 시작(backdrop tap, swipe, 뒤로가기) 시 `false`로 호출 |
| `onExit`       | `() => void`                | -      | 닫기 애니메이션 완료 후 호출 → 컴포넌트 언마운트 트리거    |
| `children`     | `ReactNode`                 | -      | 시트 내용                                                  |
| `footer`       | `ReactNode`                 | -      | 스크롤 영역 아래에 고정되는 영역 (주 동작 버튼, 선택)      |

## 파일 구조

```
bottom-sheet/
├── bottom-sheet.tsx                   # gorhom 기반 기본 바텀시트
├── keyboard-bottom-sheet.tsx          # gorhom 기반 키보드 연동 바텀시트
├── modal-bottom-sheet.tsx             # Overlay 절대 위치 기반 바텀시트 (시트 위 시트)
├── sheet-route.ts                     # 시트 route Stack 옵션과 route 떠나기 규칙
├── sheet-route-screen.tsx             # 시트 route 화면 바탕 (제스처 루트 + 크기 확정 대기 + Overlay)
├── full-window-host-context.ts        # 시트가 내비게이터 위 전체 창(route·overlay)에 그려지는지
├── use-sheet-route.ts                 # 시트 route의 열림 상태와 한 번만 떠나기
├── use-android-sheet-back-handler.ts  # 열린 시트의 시스템 뒤로가기 구독과 정리
├── motion.ts                          # 모션 감소용 애니메이션 시간 해석
├── get-sheet-horizontal-margins.ts    # 주어진 영역 기준 최대 폭·가운데 정렬 여백
├── get-sheet-layout.ts                # 호스트·reserved region·safe area로 좌우 여백, 위쪽 한계, 최대 높이 계산
├── use-sheet-layout.ts                # 위 계산에 창 크기·safe area·reserved region을 넣는 훅
├── constants.ts                       # 공유 스타일, 상수
├── index.ts                           # barrel export
└── bottom-sheet.md                    # 이 문서
```

## 배치 (iPhone Duo·폴더블)

[Expo의 iPhone Duo 가이드](https://expo.dev/blog/supporting-iphone-duo)대로 시트가 놓인 호스트에 따라 피할 영역을 정한다.
배치 기하는 `react-native-reserved-regions`가 잰 값만 쓰고 직접 추정하지 않는다.

| 호스트                                      | 좌우                                                                | 위쪽 한계                                                     |
| ------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------- |
| 화면 안(탭 레일이 시트 위에 남음)           | 가로 safe area(세로 레일)를 피해 최대 폭 560 가운데 정렬            | 위쪽 safe area                                                |
| 전체 창(route 시트, overlay, HeroUI Portal) | 레일을 덮으므로 좌우 대칭. 세로 접힘선이 있으면 더 넓은 면에만 둔다 | 위쪽 safe area와 겹치는 occlusion(레일의 상태 표시) 중 아래쪽 |

최대 높이는 위쪽 한계와 아래 여백 사이(`getSheetMaxHeight`)이고, 내용이 더 길면 시트 안에서 스크롤한다.
route 시트는 모달이 크기를 받은 뒤 그려서, 시트에서 시트로
replace할 때 크기가 정해지기 전 위치로 열리지 않게 한다. HeroUI Portal처럼 Context를 이어받지 않는
전체 창 호스트는 `useSheetLayout({ minMargin, isFullWindowHost: true })`로 같은 계산을 쓴다.

## Android 뒤로가기와 정리 (1.11.0)

열린 `BottomSheet`, `KeyboardBottomSheet`, `ModalBottomSheet`는
공용 `useAndroidSheetBackHandler`에서 시스템 뒤로가기를 소비한다. 가장 마지막에 열린 시트가
먼저 닫히며, 닫힘 이후에는 기존 Expo Router 화면 뒤로가기가 이어진다. 절대 위치
`ModalBottomSheet`는 종료 애니메이션 중에도 이벤트를 소비해 같은 입력이 아래 화면까지
전파되지 않게 한다. React Native `BackHandler`의 구독은 cleanup에서 제거한다.

`KeyboardBottomSheet`의 내용 크기·키보드 변경은 하나의 예약 resize frame으로 모은다.
시트가 닫히거나 unmount되면 frame을 취소하고, forceClose 재시도 timer도 정리한다.
키보드 시트의 index·최소 높이·상단 여백은 `constants.ts`를 재사용한다.

전역 `OverlayProvider`의 선택적 `resetKey`에는 bootstrap에서 `usePathname()`을 전달한다.
푸시·딥링크 등으로 실제 화면 경로가 바뀌면 이전 오버레이가 새 화면 위에 남지 않는다.
검색 파라미터만 변경하는 탭·날짜 선택은 pathname이 같으므로 현재 시트를 임의로 닫지 않는다.

- [React Native BackHandler](https://reactnative.dev/docs/backhandler)
- [React useEffectEvent: listener와 최신 callback](https://react.dev/reference/react/useEffectEvent)
- [Expo Router navigation](https://docs.expo.dev/router/basics/navigation/)
