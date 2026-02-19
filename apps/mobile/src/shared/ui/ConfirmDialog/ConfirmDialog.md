# ConfirmDialog

중요 액션 실행 전 사용자 선택을 확인하는 다이얼로그. 버튼 레이아웃 자동화 내장.

- `cancelButton` + `confirmButton`: 양쪽 버튼이 각각 `flex-1`로 균등 분할
- `confirmButton`만: 버튼이 오른쪽 정렬

## 사용법

### 취소 + 확인 (기본)

```tsx
import { ConfirmDialog } from '@src/shared/ui/ConfirmDialog';

<ConfirmDialog
  isOpen={isOpen}
  onOpenChange={setIsOpen}
  title={<ConfirmDialog.Title>할 일을 삭제할까요?</ConfirmDialog.Title>}
  description={<ConfirmDialog.Description>삭제하면 되돌릴 수 없어요</ConfirmDialog.Description>}
  cancelButton={
    <ConfirmDialog.CancelButton onPress={() => setIsOpen(false)}>
      취소
    </ConfirmDialog.CancelButton>
  }
  confirmButton={
    <ConfirmDialog.ConfirmButton color="danger" onPress={handleDelete}>
      삭제
    </ConfirmDialog.ConfirmButton>
  }
/>
```

### 확인만 (오른쪽 정렬)

```tsx
<ConfirmDialog
  isOpen={isOpen}
  onOpenChange={setIsOpen}
  title={<ConfirmDialog.Title>아이콘 변경 실패</ConfirmDialog.Title>}
  description={<ConfirmDialog.Description>실기기에서 다시 시도해 주세요.</ConfirmDialog.Description>}
  confirmButton={
    <ConfirmDialog.ConfirmButton onPress={() => setIsOpen(false)}>
      확인
    </ConfirmDialog.ConfirmButton>
  }
/>
```

## Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `isOpen` | `boolean` | — | 다이얼로그 열림 상태 |
| `onOpenChange` | `(open: boolean) => void` | — | 열림 상태 변경 콜백 |
| `title` | `ReactNode` | — | 제목 영역 (`ConfirmDialog.Title` 권장) |
| `description` | `ReactNode` | — | 설명 영역 (`ConfirmDialog.Description` 권장) |
| `cancelButton` | `ReactNode` | `undefined` | 취소 버튼 (없으면 confirmButton 오른쪽 정렬) |
| `confirmButton` | `ReactNode` | — | 확인 버튼 (`ConfirmDialog.ConfirmButton` 권장) |

## 버튼 레이아웃

버튼에 `className="flex-1"`을 직접 지정하지 않습니다. ConfirmDialog 내부에서 자동으로 처리합니다.

```tsx
// ❌ 금지 - 직접 flex-1 지정
<ConfirmDialog.CancelButton className="flex-1" ...>취소</ConfirmDialog.CancelButton>

// ✅ 올바름 - 내부에서 자동 처리
<ConfirmDialog.CancelButton ...>취소</ConfirmDialog.CancelButton>
```

## 파일 구조

| 파일 | 역할 |
|------|------|
| `ConfirmDialog.tsx` | 컴포넌트 + 서브컴포넌트 |
| `ConfirmDialog.types.ts` | Props 인터페이스 |
| `index.ts` | Barrel export |
| `ConfirmDialog.md` | 이 문서 |
