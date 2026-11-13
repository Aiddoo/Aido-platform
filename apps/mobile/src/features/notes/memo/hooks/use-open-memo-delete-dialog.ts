import { useTranslation } from '@src/shared/i18n';
import { useConfirmDialog } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';

import { useDeleteMemoMutationOptions } from '../queries/memo.mutations';

interface UseOpenMemoDeleteDialogOptions {
  memoId: number;
  onDeleted?: () => void;
}

/** 지우는 동안 다이얼로그를 남기고 버튼만 불러오는 중으로 바꾼다. 실패하면 남은 다이얼로그에서 다시 누른다 */
export function useOpenMemoDeleteDialog({ memoId, onDeleted }: UseOpenMemoDeleteDialogOptions) {
  const { t } = useTranslation(['memo', 'common']);
  const confirmDialog = useConfirmDialog();
  const deleteMemo = useMutation(useDeleteMemoMutationOptions());

  return async () => {
    const isDeleted = await confirmDialog.openAsync({
      title: t('memo:detail.deleteConfirmTitle'),
      description: t('memo:detail.deleteConfirmDescription'),
      cancelLabel: t('common:actions.cancel'),
      confirmLabel: t('common:actions.delete'),
      confirmColor: 'danger',
      onConfirm: () => deleteMemo.mutateAsync(memoId),
    });
    if (isDeleted) {
      onDeleted?.();
    }
  };
}
