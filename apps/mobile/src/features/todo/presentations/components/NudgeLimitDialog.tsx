import { ConfirmDialog } from '@src/shared/ui/ConfirmDialog';

interface NudgeLimitDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NudgeLimitDialog({ isOpen, onOpenChange }: NudgeLimitDialogProps) {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={<ConfirmDialog.Title>오늘 콕 찌르기를 다 했어요</ConfirmDialog.Title>}
      description={
        <ConfirmDialog.Description>구독하면 무제한으로 찌를 수 있어요</ConfirmDialog.Description>
      }
      cancelButton={
        <ConfirmDialog.CancelButton onPress={() => onOpenChange(false)}>
          닫기
        </ConfirmDialog.CancelButton>
      }
      confirmButton={
        <ConfirmDialog.ConfirmButton
          onPress={() => {
            //TODO: 구독하기로 이동
            onOpenChange(false);
          }}
        >
          구독하기
        </ConfirmDialog.ConfirmButton>
      }
    />
  );
}
