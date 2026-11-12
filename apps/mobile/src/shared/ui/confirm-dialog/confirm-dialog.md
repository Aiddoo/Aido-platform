# ConfirmDialog

중요한 동작 전에 확인을 받는 다이얼로그. 띄우기는 `useConfirmDialog().openAsync` 하나이고, 확인 뒤 일이 끝날 때까지의 진행 상태와 실패 처리를 다이얼로그가 스스로 갖는다.

## 사용법

```tsx
const confirmDialog = useConfirmDialog();

const handleDeletePress = async () => {
  const isDeleted = await confirmDialog.openAsync({
    title: t('memo:detail.deleteConfirmTitle'),
    description: t('memo:detail.deleteConfirmDescription'),
    cancelLabel: t('common:actions.cancel'),
    confirmLabel: t('common:actions.delete'),
    confirmColor: 'danger',
    onConfirm: () => deleteMemo.mutateAsync(memoId),
  });
  if (isDeleted) {
    onDeleted();
  }
};
```

`onConfirm`이 없으면 누르는 즉시 닫고 `true`다. 확인만 받고 일은 호출부가 한다(로그아웃은 오프라인에도 멈추지 않고 끝나 남길 실패가 없다).

## 옵션

| 옵션                | 타입            | 설명                                           |
| ------------------- | --------------- | ---------------------------------------------- |
| `title`             | `ReactNode`     | 제목                                           |
| `description`       | `ReactNode`     | 설명. 문자열이면 단어 단위로 줄을 바꾼다       |
| `confirmLabel`      | `string`        | 확인 버튼 글자                                 |
| `confirmColor`      | 버튼 `color`    | 파괴 동작은 `danger`                           |
| `cancelLabel`       | `string`        | 없으면 확인 버튼만 오른쪽에 둔다               |
| `confirmTestID`     | `string`        | Maestro가 확인 버튼을 찾는 testID              |
| `isConfirmDisabled` | `boolean`       | 안내만 하고 확인을 막는다(마지막 카테고리)     |
| `onConfirm`         | `() => unknown` | 확인 뒤 기다릴 일. 보통 `mutation.mutateAsync` |

`Promise<boolean>`을 돌려준다. 확인하고 일이 끝나면 `true`, 취소·바깥 탭·뒤로 가기·답 없이 사라짐은 `false`다.

## 동작

- `onConfirm`이 도는 동안 다이얼로그는 열려 있고 확인 버튼이 진행 중, 취소·바깥 탭·뒤로 가기는 막힌다.
- `onConfirm`이 던지면 다이얼로그를 남기고 버튼을 되살려 다시 누르거나 취소할 수 있다. 실패 토스트는 mutation의 `meta.errorFeedback`이 한 번 띄운다.
- 모든 호출부가 `onConfirm`을 쓴다. 낙관적 갱신으로 행이 바로 빠지는 mutation(친구 끊기·댓글 삭제)도 같다. 다이얼로그는 행과 따로 떠 있어 진행 중으로 남고, 실패하면 행이 제자리로 돌아오며 다이얼로그가 남는다.
- 다시 눌러도 같은 실패는 `onConfirm` 안에서 삼켜 닫는다. 비밀번호가 틀린 탈퇴는 닫고 그 칸에 오류를 보이고, 이미 지워진 댓글은 지운 것과 같아 닫는다.
- 열 때의 내용이 굳으므로 진행 상태는 다이얼로그 안의 컴포넌트가 갖는다([overlay](../overlay/overlay.md)).
- 버튼 배치는 다이얼로그가 정한다: 취소 + 확인은 나란히 같은 폭, 가장 큰 글자에서는 확인 위·취소 아래로 쌓는다. 버튼에 `flex-1`을 주지 않는다.
- 태블릿·펼친 폴더블에서도 읽기 폭(`READABLE_CONTENT_MAX_WIDTH`)에서 멈춘다.

## route가 그리는 확인

route 자체가 확인인 화면(차단 `/users/[userId]/block`, 남길 할 일이 없는 카테고리 지우기)은 `ConfirmDialog`를 직접 그린다. `openAsync`와 같은 옵션에 `isOpen`·`onFinish(isConfirmed)`를 더한 것이고, 진행 상태와 실패 시 남기는 동작도 같다. 열림은 route(`useSheetRoute`)가 갖고, 답하면 route를 떠난다. route가 그리므로 설명·확인 막기 같은 내용은 조회 값을 따라 바뀐다.

```tsx
const dialog = useSheetRoute('/feed');

<ConfirmDialog
  isOpen={dialog.isOpen}
  title={t('block.confirmTitle', { name })}
  cancelLabel={t('common:actions.cancel')}
  confirmLabel={t('block.confirm')}
  confirmColor="danger"
  onConfirm={() => blockUser.mutateAsync({ userId, displayName: name })}
  onFinish={() => dialog.exit()}
/>;
```

진행 가드(지우는 중 닫기 막기, 버튼 잠금)를 호출부가 다시 만들지 않는다.
