import { ConfirmDialog } from '@src/shared/ui';

interface FriendDeleteConfirmDialogProps {
  isOpen: boolean;
  isProcessing: boolean;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function FriendDeleteConfirmDialog({
  isOpen,
  isProcessing,
  onOpenChange,
  onCancel,
  onConfirm,
}: FriendDeleteConfirmDialogProps) {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={<ConfirmDialog.Title>친구를 삭제할까요?</ConfirmDialog.Title>}
      description={
        <ConfirmDialog.Description>삭제하면 서로의 할 일이 보이지 않아요</ConfirmDialog.Description>
      }
      cancelButton={
        <ConfirmDialog.CancelButton onPress={onCancel} disabled={isProcessing}>
          취소
        </ConfirmDialog.CancelButton>
      }
      confirmButton={
        <ConfirmDialog.ConfirmButton color="danger" onPress={onConfirm} isLoading={isProcessing}>
          삭제
        </ConfirmDialog.ConfirmButton>
      }
    />
  );
}
