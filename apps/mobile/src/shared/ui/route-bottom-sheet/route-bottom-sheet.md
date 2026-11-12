# RouteBottomSheet

대상이 있는 시트 route(`/todo/[todoId]/actions` 등)의 껍데기 하나다. route 떠나기(`useSheetRoute`), 조회 오류 경계, 읽는 동안의 `.Loading`을 한 번에 둔다. 시트마다 같은 경계와 문의 연결을 다시 쓰지 않게 하려고 둔다.

## 사용법

```tsx
export function TodoDateBottomSheet(props: TodoDateBottomSheetProps) {
  return (
    <RouteBottomSheet {...props} fallbackHref="/feed" loading={<TodoDateBottomSheet.Loading />}>
      {(sheet) => <TodoDateBottomSheet.DateForm onClose={() => sheet.close()} />}
    </RouteBottomSheet>
  );
}
```

입력이 있는 시트는 `RouteKeyboardBottomSheet`다. 경계와 떠나기는 같고 시트만 `KeyboardBottomSheet`다.

## Props

| prop           | 타입                               | 설명                                                      |
| -------------- | ---------------------------------- | --------------------------------------------------------- |
| `fallbackHref` | `Href`                             | 딥링크로 바로 열려 돌아갈 화면이 없을 때 바꿀 화면        |
| `loading`      | `ReactNode`                        | 대상을 읽는 동안 내용 자리. 내용과 같은 높이의 `.Loading` |
| `children`     | `(sheet: RouteSheet) => ReactNode` | 내용. 대상은 route 훅(`useSheetTodo`)으로 읽는다          |
| `footer`       | `(sheet: RouteSheet) => ReactNode` | 시트 아래 고정 영역(주 버튼). 경계 밖이다                 |

`RouteSheet`는 `{ isOpen, close(next?), exit(next?) }`다. 나머지는 `...props`(`BottomSheet`·`KeyboardBottomSheet`에서 `isOpen`·`onOpenChange`·`children`·`footer`를 뺀 것)다.

## 동작

- `close(next?)`는 닫기 애니메이션이 끝난 뒤 route를 한 번만 떠난다. 기본은 뒤로이고 다음 시트·화면은 `{ type: 'replace', href }`, 완료 뒤 아래 화면도 바꾸면 `{ type: 'back-then-replace', href }`다. `exit(next?)`는 애니메이션 없이 바로 떠난다(구독 화면 이동).
- 조회가 실패하면 시트 안에 다시 시도 + 문의하기를 보인다. 문의는 시트를 닫고 그 자리를 문의 화면으로 바꾼다(`INQUIRY_SHEET_EXIT`).
- `footer`는 경계 밖이라 내용이 읽는 중이거나 실패해도 그대로 있다. 폼을 함께 보려면 폼을 시트를 그리는 컴포넌트가 갖는다(날씨 옮기기).
- 닫히는 동안 내용을 바로 지워야 하는 시트만 `sheet.isOpen &&`로 감싼다(제안 카테고리, 날씨 옮기기).
- `useSheetRoute`를 직접 쓰는 곳은 경계를 시트 안에 한 번에 둘 수 없는 route뿐이다: 폼이 시트와 `footer`를 함께 가져 경계가 시트 밖에 있는 시트(할 일 만들기·고치기, 카테고리 만들기·고치기·지우기, 신고, 콕, 초대 환영)와 머리글이 경계 밖에 있는 감사 목록, 시트 대신 `ConfirmDialog`(`isOpen={sheet.isOpen}`, `onFinish={() => sheet.exit()}`)를 그리는 확인 route(차단, 남길 할 일이 없는 카테고리 지우기)다.
