# Overlay

화면 밖(루트)에 다이얼로그·시트를 띄우는 명령형 API입니다. 인터페이스는 [overlay-kit](https://github.com/toss/overlay-kit)과 같습니다. 대상이 있는 시트는 overlay가 아니라 route(`RouteBottomSheet`)입니다.

## 고르는 법

| 띄울 것                                         | 쓰는 것                        |
| ----------------------------------------------- | ------------------------------ |
| 값을 고르는 시트(날짜·시간·반복·카테고리 피커)  | `useOpenSheet()`               |
| 폼이 `footer`를 가진 입력 시트(콕, 계획 고치기) | `useOpenKeyboardSheet()`       |
| 확인 다이얼로그                                 | `useConfirmDialog().openAsync` |
| 답을 받아 흐름을 잇는 시트(동의, 구독 안내)     | `useOverlay().openAsync`       |

## 사용법

값을 고르는 시트는 `useOpenSheet`로 띄우고 `await`로 값을 받습니다. 내용은 `close(value)`로 값을 돌려주고, 취소·끌어 내림·부른 화면이 사라짐은 모두 `undefined`입니다. 취소를 따로 구별하지 않습니다.

```tsx
const openSheet = useOpenSheet();

const startDate = await openSheet<DateKey>(
  (close) => <TodoDatePicker value={value.startDate} onChange={close} onCancel={() => close()} />,
  { hasFixedHeader: true },
);
if (startDate != null) {
  onChange(startDate);
}
```

입력 시트는 내용이 `KeyboardBottomSheet`를 스스로 그립니다. `onOpenChange(false)`가 오면 지우고, `close()`는 닫기 애니메이션을 시작합니다.

```tsx
const openKeyboardSheet = useOpenKeyboardSheet();

openKeyboardSheet(({ isOpen, onOpenChange }) => (
  <NudgeBottomSheet receiver={receiver} todo={todo} isOpen={isOpen} onOpenChange={onOpenChange} />
));
```

답을 받아 흐름을 이어 가야 하면 `openAsync`와 `await`를 씁니다. 값을 담아 둘 `let`이나 ref를 따로 두지 않습니다.

```tsx
const choice = await overlay.openAsync<UpsellChoice>(
  ({ isOpen, close, unmount }) => (
    <PremiumUpsellBottomSheet
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          close('dismiss');
        }
      }}
      onExit={unmount}
      onSubscribe={() => close('subscribe')}
    />
  ),
  { dismissedValue: null },
);
```

## API

| 항목                                       | 설명                                                                              |
| ------------------------------------------ | --------------------------------------------------------------------------------- |
| `OverlayProvider`                          | 앱 루트와 시트 route에 둔다. 열린 overlay와 시트·다이얼로그의 PortalHost를 그린다 |
| `useOpenSheet()`                           | `openSheet(render, OpenSheetOptions)` → `Promise<T \| undefined>`                 |
| `useOpenKeyboardSheet()`                   | `openKeyboardSheet(({ isOpen, onOpenChange, close }) => …)`                       |
| `useOverlay()`                             | `{ open, openAsync }`. Provider 밖에서는 오류를 던진다                            |
| `open(({ isOpen, close, unmount }) => …)`  | 띄운다. 돌려주는 값이 없다(`useOpenKeyboardSheet`가 이것 위에 있다)               |
| `openAsync<T>(render, { dismissedValue })` | 띄우고 `Promise<T>`를 돌려준다. 답 없이 사라지면 `dismissedValue`로 끝난다        |
| `close()` / `close(value)`                 | `isOpen`을 false로 바꾼다. `openAsync`는 이때 resolve                             |
| `unmount()`                                | 트리에서 뺀다. 닫힘 애니메이션이 끝난 뒤(`onExit`) 부른다                         |
| `useOverlayState()`                        | 현재 열린 overlay 상태를 읽는다                                                   |

## overlay-kit과 다른 점

- 전역 `overlay` 대신 훅으로 받습니다. 부른 컴포넌트가 unmount되면 띄운 것도 함께 사라져 화면을 떠난 뒤 시트가 남지 않습니다.
- 훅 하나는 overlay 하나를 띄웁니다. 같은 훅으로 다시 열면 이전 것을 바꿉니다.
- `reject`와 `closeAll` 같은 전역 제어는 없습니다. 로그아웃 때는 `OverlayProvider`의 `resetKey`가 전부 지웁니다.

## 주의

- 열 때의 화면이 스냅샷으로 굳는다. 부모의 반응형 값(`mutation.isPending` 등)을 props로 넘기지 말고, 띄운 내용이 자기 상태를 스스로 갖게 한다.
- `close` 없이 사라지면 `openAsync`는 `dismissedValue`로 끝나고 `await` 뒤의 코드는 화면이 없어진 뒤에도 실행된다. 사용자가 답하지 않은 일을 답으로 저장하면 안 되는 곳은 "취소"와 구별되는 값(`null`)을 정하거나 화면이 남아 있는지 먼저 본다.
- `await` 뒤의 코드는 닫힘 애니메이션이 시작될 때 실행된다.
