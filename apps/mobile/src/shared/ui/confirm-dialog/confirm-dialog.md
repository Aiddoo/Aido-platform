# ConfirmDialog

중요 액션 실행 전 사용자 선택을 확인하는 다이얼로그. 버튼 레이아웃 자동화 내장.

- `cancelButton` + `confirmButton`: 양쪽 버튼이 각각 `flex-1`로 균등 분할
- `confirmButton`만: 버튼이 오른쪽 정렬
- `secondaryButton`이 있으면: 확인 → 두 번째 행동 → 취소 순서로 전체 폭 세로 배치(친구 한도 안내의 초대·구독·닫기)

## 사용법

### 취소 + 확인 (기본)

```tsx
import { ConfirmDialog } from '@src/shared/ui/confirm-dialog';

<ConfirmDialog
  isOpen={isOpen}
  onOpenChange={setIsOpen}
  title={<ConfirmDialog.Title>할 일을 삭제할까요?</ConfirmDialog.Title>}
  description={<ConfirmDialog.Description>삭제하면 되돌릴 수 없어요</ConfirmDialog.Description>}
  cancelButton={
    <ConfirmDialog.CancelButton onPress={() => setIsOpen(false)}>취소</ConfirmDialog.CancelButton>
  }
  confirmButton={
    <ConfirmDialog.ConfirmButton color="danger" onPress={handleDelete}>
      삭제
    </ConfirmDialog.ConfirmButton>
  }
/>;
```

### 확인만 (오른쪽 정렬)

```tsx
<ConfirmDialog
  isOpen={isOpen}
  onOpenChange={setIsOpen}
  title={<ConfirmDialog.Title>아이콘 변경 실패</ConfirmDialog.Title>}
  description={
    <ConfirmDialog.Description>실기기에서 다시 시도해 주세요.</ConfirmDialog.Description>
  }
  confirmButton={
    <ConfirmDialog.ConfirmButton onPress={() => setIsOpen(false)}>확인</ConfirmDialog.ConfirmButton>
  }
/>
```

## Props

| Prop              | 타입                      | 기본값      | 설명                                                |
| ----------------- | ------------------------- | ----------- | --------------------------------------------------- |
| `isOpen`          | `boolean`                 | —           | 다이얼로그 열림 상태                                |
| `onOpenChange`    | `(open: boolean) => void` | —           | 열림 상태 변경 콜백                                 |
| `title`           | `ReactNode`               | —           | 제목 영역 (`ConfirmDialog.Title` 권장)              |
| `description`     | `ReactNode`               | —           | 설명 영역 (`ConfirmDialog.Description` 권장)        |
| `cancelButton`    | `ReactNode`               | `undefined` | 취소 버튼 (없으면 confirmButton 오른쪽 정렬)        |
| `confirmButton`   | `ReactNode`               | —           | 확인 버튼 (`ConfirmDialog.ConfirmButton` 권장)      |
| `secondaryButton` | `ReactNode`               | `undefined` | 확인 아래 두 번째 행동. 있으면 버튼을 세로로 쌓는다 |

## 버튼 레이아웃

버튼에 `className="flex-1"`을 직접 지정하지 않습니다. ConfirmDialog 내부에서 자동으로 처리합니다.

```tsx
// ❌ 금지 - 직접 flex-1 지정
<ConfirmDialog.CancelButton className="flex-1" ...>취소</ConfirmDialog.CancelButton>

// ✅ 올바름 - 내부에서 자동 처리
<ConfirmDialog.CancelButton ...>취소</ConfirmDialog.CancelButton>
```

## 파일 구조

| 파일                     | 역할                    |
| ------------------------ | ----------------------- |
| `ConfirmDialog.tsx`      | 컴포넌트 + 서브컴포넌트 |
| `ConfirmDialog.types.ts` | Props 인터페이스        |
| `index.ts`               | Barrel export           |
| `ConfirmDialog.md`       | 이 문서                 |

## useConfirmDialog — Overlay로 띄우고 결과 받기

화면 상태 없이 확인 여부만 필요하면 `useConfirmDialog`를 쓴다. 닫기·취소는 `false`,
확인은 `true`로 resolve된다. `close`·`exit` 호출을 사용처에서 반복하지 않는다.

```tsx
import { useConfirmDialog } from '@src/shared/ui';

const confirmDialog = useConfirmDialog();

const handleLogoutPress = async () => {
  const isConfirmed = await confirmDialog.open({
    title: t('logout.confirmTitle'),
    description: t('logout.confirmDescription'),
    cancelLabel: t('common:actions.cancel'),
    confirmLabel: t('common:actions.confirm'),
  });
  if (isConfirmed) {
    logout.mutate();
  }
};
```

다이얼로그 안에서 진행 상태를 보여 줘야 하면 Overlay 스냅샷 규칙에 따라 내용 컴포넌트가
자기 상태를 갖도록 직접 `overlay.open`을 쓴다.
