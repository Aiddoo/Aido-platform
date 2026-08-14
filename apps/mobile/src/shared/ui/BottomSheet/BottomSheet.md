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

```tsx
import { KeyboardBottomSheet } from '@src/shared/ui/BottomSheet';

<KeyboardBottomSheet isOpen={isOpen} onOpenChange={setIsOpen}>
  {/* 텍스트 입력 폼 */}
</KeyboardBottomSheet>;
```

### ModalBottomSheet

기존 BottomSheet 위에 추가 시트를 띄울 때 사용합니다. `OverlayProvider` 안에서 절대 위치 뷰로 렌더링하여 gorhom BottomSheet 위에 쌓고 Android navigation bar 충돌을 피합니다.

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
├── motion.ts                # 모션 감소용 애니메이션 시간 해석
├── constants.ts             # 공유 스타일, 상수
├── index.ts                 # barrel export
└── BottomSheet.md           # 이 문서
```
