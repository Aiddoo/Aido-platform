# Overlay

화면 밖(루트)에 다이얼로그·시트를 띄우는 명령형 API입니다. 인터페이스는 [overlay-kit](https://github.com/toss/overlay-kit)과 같습니다.

## 사용법

고른 값을 그 자리에서 반영하고 끝나면 `open`을 씁니다. 칩의 선택 시트가 여기에 해당합니다.

```tsx
const overlay = useOverlay();

overlay.open(({ isOpen, close, unmount }) => (
  <ModalBottomSheet isOpen={isOpen} onOpenChange={() => close()} onExit={unmount}>
    <TodoDatePicker
      value={startDate}
      onChange={(picked) => {
        setValue('startDate', picked);
        close();
      }}
      onCancel={close}
    />
  </ModalBottomSheet>
));
```

답을 받아 흐름을 이어 가야 하면 `openAsync`와 `await`를 씁니다. 확인 창, 동의, 수정 범위 선택이 여기에 해당합니다. 값을 담아 둘 `let`이나 ref를 따로 두지 않습니다.

```tsx
const isConfirmed = await overlay.openAsync<boolean>(
  ({ isOpen, close, unmount }) => (
    <ConfirmDialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          close(false);
          unmount();
        }
      }}
      /* ... */
    />
  ),
  { dismissedValue: false },
);
if (isConfirmed) {
  logout.mutate();
}
```

## API

| 항목                                       | 설명                                                                              |
| ------------------------------------------ | --------------------------------------------------------------------------------- |
| `OverlayProvider`                          | 앱 루트와 시트 route에 둔다. 열린 overlay와 시트·다이얼로그의 PortalHost를 그린다 |
| `useOverlay()`                             | `{ open, openAsync }`. Provider 밖에서는 오류를 던진다                            |
| `open(({ isOpen, close, unmount }) => …)`  | 띄운다. 돌려주는 값이 없다                                                        |
| `openAsync<T>(render, { dismissedValue })` | 띄우고 `Promise<T>`를 돌려준다. 답 없이 사라지면 `dismissedValue`로 끝난다        |
| `close()` / `close(value)`                 | `isOpen`을 false로 바꾼다. `openAsync`는 이때 resolve                             |
| `unmount()`                                | 트리에서 뺀다. 닫힘 애니메이션이 끝난 뒤(`onExit`) 부른다                         |
| `useOverlayState()`                        | 현재 열린 overlay 상태를 읽는다                                                   |

애니메이션이 없는 다이얼로그는 `close(); unmount();`를 함께 부릅니다.

## overlay-kit과 다른 점

- 전역 `overlay` 대신 `useOverlay()` 훅으로 받습니다. 부른 컴포넌트가 unmount되면 띄운 것도 함께 사라져 화면을 떠난 뒤 시트가 남지 않습니다.
- 훅 하나는 overlay 하나를 띄웁니다. 같은 훅으로 다시 열면 이전 것을 바꿉니다.
- `reject`와 `closeAll` 같은 전역 제어는 없습니다. 로그아웃 때는 `OverlayProvider`의 `resetKey`가 전부 지웁니다.

## 주의

- 열 때의 화면이 스냅샷으로 굳는다. 부모의 반응형 값(`mutation.isPending` 등)을 props로 넘기지 말고, 띄운 내용이 자기 상태를 스스로 갖게 한다.
- `close` 없이 사라지면(부른 컴포넌트 unmount, 다시 열기, `resetKey`) `openAsync`는 `dismissedValue`로 끝난다. `await` 뒤의 코드는 화면이 없어진 뒤에도 실행된다. 사용자가 답하지 않은 일을 답으로 저장하면 안 되는 곳은 "취소"와 구별되는 값(`null`)을 정하거나 화면이 남아 있는지 먼저 본다.
- `await` 뒤의 코드는 닫힘 애니메이션이 시작될 때 실행된다.

## 파일 구조

```
overlay/
├── overlay-provider.tsx     # Provider + controller
├── overlay-item.tsx         # 개별 overlay 렌더
├── overlay-state-context.ts # 상태 context
├── use-overlay.tsx          # open·openAsync 훅
├── use-overlay-state.ts     # 상태 훅
├── overlay.md               # 이 문서
└── index.ts                 # 배럴
```
