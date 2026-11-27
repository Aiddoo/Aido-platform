import { useTranslation } from '@src/shared/i18n';
import { useConfirmDialog } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';

import { isMemoUnavailableError } from '../domains/memo.error';
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
      // 이미 없는 메모는 지운 것과 같아 다이얼로그를 닫고 지운 뒤처럼 떠난다. 안내는 mutation이 한다
      onConfirm: () =>
        deleteMemo.mutateAsync(memoId).catch((error: unknown) => {
          if (!isMemoUnavailableError(error)) {
            throw error;
          }
        }),
    });
    if (isDeleted) {
      onDeleted?.();
    }
  };
}
