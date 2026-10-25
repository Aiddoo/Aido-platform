# Overlay

화면 밖(루트)에 다이얼로그·시트를 띄우고, 닫힐 때 값을 `Promise`로 돌려받는 명령형 API입니다.

## 사용법

```tsx
import { ConfirmDialog, useOverlay } from '@src/shared/ui';

const overlay = useOverlay();

const confirmed = await overlay.open<boolean>(({ isOpen, close, exit }) => (
  <ConfirmDialog
    isOpen={isOpen}
    onOpenChange={(open) => {
      if (!open) {
        close(false);
        exit();
      }
    }}
    title={<ConfirmDialog.Title>삭제할까요?</ConfirmDialog.Title>}
  />
));
```

## API

| 항목                | 설명                                                                     |
| ------------------- | ------------------------------------------------------------------------ |
| `OverlayProvider`   | 앱 루트에 한 번 둔다. 열린 overlay를 렌더한다                            |
| `useOverlay()`      | `{ open }`을 돌려준다. Provider 밖에서는 오류를 던진다                   |
| `open<T>(render)`   | `render({ isOpen, close, exit })`를 띄우고 `close(value)`의 값을 resolve |
| `useOverlayState()` | 현재 열린 overlay 상태를 읽는다                                          |

## 주의

열 때의 화면이 스냅샷으로 굳는다. 부모의 반응형 값(`mutation.isPending` 등)을 props로 넘기지 말고,
띄운 내용이 자기 상태를 스스로 갖게 한다. 컴포넌트가 unmount되면 해당 overlay도 함께 정리된다.

## 파일 구조

```
overlay/
├── overlay-provider.tsx     # Provider + controller
├── overlay-item.tsx         # 개별 overlay 렌더
├── overlay-state-context.ts # 상태 context
├── use-overlay.tsx          # open 훅
├── use-overlay-state.ts     # 상태 훅
├── overlay.md               # 이 문서
└── index.ts                 # 배럴
```
