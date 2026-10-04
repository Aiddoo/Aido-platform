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
import { BottomSheet } from '@src/shared/ui/BottomSheet';

<BottomSheet isOpen={isOpen} onOpenChange={setIsOpen}>
  {/* 피커, 액션시트 등 */}
</BottomSheet>;
```

### KeyboardBottomSheet

내용은 스크롤된다. 짧으면 시트가 그 높이로 줄어들지만, 키보드가 올라온 채로 내용이
길어지면 아래쪽 버튼에 손이 닿지 않기 때문이다. 그래서 시트 안에 세로 스크롤 컨테이너를
또 두면 안 된다 (가로 스크롤은 무방하다).

```tsx
import { KeyboardBottomSheet } from '@src/shared/ui/BottomSheet';

<KeyboardBottomSheet isOpen={isOpen} onOpenChange={setIsOpen}>
  {/* 텍스트 입력 폼 */}
</KeyboardBottomSheet>;
```

### ModalBottomSheet

기존 BottomSheet 위에 추가 시트를 띄울 때 사용합니다. 드래그 닫기는 상단 손잡이에서 동작하여 내부 목록 스크롤과 경쟁하지 않습니다. 시스템 Reduce Motion을 따르고, `reduceMotion`으로 애니메이션을 명시적으로 끌 수 있습니다. `OverlayProvider` 안에서 절대 위치 뷰로 렌더링하여 gorhom BottomSheet 위에 쌓고 Android navigation bar 충돌을 피합니다.

```tsx
import { ModalBottomSheet } from '@src/shared/ui/BottomSheet';

// useOverlay 등으로 isOpen/onClose/onExit를 관리
<ModalBottomSheet
  isOpen={isOpen}
  onClose={handleClose}
  onExit={handleExit}
  reduceMotion={prefersReducedMotion}
>
  {/* 피커 내용 */}
</ModalBottomSheet>;
```

## Props

### BottomSheet

| Prop           | 타입                        | 기본값 | 설명                     |
| -------------- | --------------------------- | ------ | ------------------------ |
| `isOpen`       | `boolean`                   | -      | 시트 열림 상태           |
| `onOpenChange` | `(isOpen: boolean) => void` | -      | 열림/닫힘 상태 변경 콜백 |
| `onCloseStart` | `() => void`                | -      | 닫기 시작 시 콜백 (선택) |
| `children`     | `ReactNode`                 | -      | 시트 내용                |

### ModalBottomSheet

| Prop           | 타입         | 기본값  | 설명                                                           |
| -------------- | ------------ | ------- | -------------------------------------------------------------- |
| `isOpen`       | `boolean`    | -       | 시트 열림 상태                                                 |
| `onClose`      | `() => void` | -       | 닫기 시작 (backdrop tap, swipe) → 부모가 isOpen을 false로 전환 |
| `onExit`       | `() => void` | -       | 닫기 애니메이션 완료 후 호출 → 컴포넌트 언마운트 트리거        |
| `reduceMotion` | `boolean`    | `false` | 시스템 모션 감소 설정에 맞춰 전환 시간을 제거                  |
| `children`     | `ReactNode`  | -       | 시트 내용                                                      |

## 파일 구조

```
BottomSheet/
├── BottomSheet.tsx          # gorhom 기반 기본 바텀시트
├── KeyboardBottomSheet.tsx  # gorhom 기반 키보드 연동 바텀시트
├── ModalBottomSheet.tsx     # Overlay 절대 위치 기반 바텀시트 (시트 위 시트)
├── StackedBottomSheetModal.tsx # gorhom modal 기반 중첩 시트
├── useAndroidSheetBackHandler.ts # 열린 시트의 시스템 뒤로가기 구독과 정리
├── motion.ts                # 모션 감소용 애니메이션 시간 해석
├── constants.ts             # 공유 스타일, 상수
├── index.ts                 # barrel export
└── BottomSheet.md           # 이 문서
```

## Android 뒤로가기와 정리 (1.11.0)

열린 `BottomSheet`, `KeyboardBottomSheet`, `StackedBottomSheetModal`, `ModalBottomSheet`는
공용 `useAndroidSheetBackHandler`에서 시스템 뒤로가기를 소비한다. 가장 마지막에 열린 시트가
먼저 닫히며, 닫힘 이후에는 기존 Expo Router 화면 뒤로가기가 이어진다. 절대 위치
`ModalBottomSheet`는 종료 애니메이션 중에도 이벤트를 소비해 같은 입력이 아래 화면까지
전파되지 않게 한다. React Native `BackHandler`의 구독은 cleanup에서 제거한다.

`KeyboardBottomSheet`의 내용 크기·키보드 변경은 하나의 예약 resize frame으로 모은다.
시트가 닫히거나 unmount되면 frame을 취소하고, forceClose 재시도 timer도 정리한다.
`useBottomSheetModal.close()`는 아직 실행되지 않은 `present()` frame을 취소한다.
키보드 시트의 index·최소 높이·상단 여백은 `constants.ts`를 재사용한다.

전역 `OverlayProvider`의 선택적 `resetKey`에는 bootstrap에서 `usePathname()`을 전달한다.
푸시·딥링크 등으로 실제 화면 경로가 바뀌면 이전 오버레이가 새 화면 위에 남지 않는다.
검색 파라미터만 변경하는 탭·날짜 선택은 pathname이 같으므로 현재 시트를 임의로 닫지 않는다.

- [React Native BackHandler](https://reactnative.dev/docs/backhandler)
- [React useEffectEvent: listener와 최신 callback](https://react.dev/reference/react/useEffectEvent)
- [Expo Router navigation](https://docs.expo.dev/router/basics/navigation/)
