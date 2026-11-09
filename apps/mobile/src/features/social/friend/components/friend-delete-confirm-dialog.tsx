import { useTranslation } from '@src/shared/i18n';
import { ConfirmDialog } from '@src/shared/ui';

interface FriendDeleteConfirmDialogProps {
  /** 지울 친구 이름. 목록에서 누른 줄이 맞는지 다이얼로그에서 확인하게 한다 */
  name: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function FriendDeleteConfirmDialog({
  name,
  isOpen,
  onOpenChange,
  onCancel,
  onConfirm,
}: FriendDeleteConfirmDialogProps) {
  const { t } = useTranslation(['friend', 'common']);

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={<ConfirmDialog.Title>{t('deleteDialog.title', { name })}</ConfirmDialog.Title>}
      description={
        <ConfirmDialog.Description>{t('deleteDialog.description')}</ConfirmDialog.Description>
      }
      cancelButton={
        <ConfirmDialog.CancelButton onPress={onCancel}>
          {t('common:actions.cancel')}
        </ConfirmDialog.CancelButton>
      }
      confirmButton={
        <ConfirmDialog.ConfirmButton
          testID="friend-delete-confirm"
          color="danger"
          onPress={onConfirm}
        >
          {t('common:actions.delete')}
        </ConfirmDialog.ConfirmButton>
      }
    />
  );
}
