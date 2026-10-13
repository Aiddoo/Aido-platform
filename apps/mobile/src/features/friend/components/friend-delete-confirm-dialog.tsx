import { useTranslation } from '@src/shared/i18n';
import { ConfirmDialog } from '@src/shared/ui';

interface FriendDeleteConfirmDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function FriendDeleteConfirmDialog({
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
      title={<ConfirmDialog.Title>{t('deleteDialog.title')}</ConfirmDialog.Title>}
      description={
        <ConfirmDialog.Description>{t('deleteDialog.description')}</ConfirmDialog.Description>
      }
      cancelButton={
        <ConfirmDialog.CancelButton onPress={onCancel}>
          {t('common:actions.cancel')}
        </ConfirmDialog.CancelButton>
      }
      confirmButton={
        <ConfirmDialog.ConfirmButton color="danger" onPress={onConfirm}>
          {t('common:actions.delete')}
        </ConfirmDialog.ConfirmButton>
      }
    />
  );
}
