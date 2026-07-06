import { useMemoService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { MEMO_QUERY_KEYS } from '../constants/memo-query-keys.constant';

export const useDeleteMemoMutationOptions = () => {
  const service = useMemoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (memoId: number) => {
      const result = await service.deleteMemo(memoId);
      return unwrap(result);
    },
    onSuccess: (_, memoId) => {
      toast.success(t('memo:toasts.deleted'));
      trackEvent('memo_deleted', { memo_id: memoId });
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (isApiError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(undefined, { fallback: t('memo:toasts.deleteRetry') });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: MEMO_QUERY_KEYS.all });
    },
  });
};
