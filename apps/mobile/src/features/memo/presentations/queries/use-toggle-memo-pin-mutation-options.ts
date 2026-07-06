import { useMemoService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { MEMO_QUERY_KEYS } from '../constants/memo-query-keys.constant';

interface ToggleMemoPinMutationParams {
  memoId: number;
  isPinned: boolean;
}

export const useToggleMemoPinMutationOptions = () => {
  const service = useMemoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async ({ memoId, isPinned }: ToggleMemoPinMutationParams) => {
      const result = await service.togglePin(memoId, { isPinned });
      return unwrap(result);
    },
    onSuccess: (_, { memoId, isPinned }) => {
      trackEvent('memo_pin_toggled', { memo_id: memoId, is_pinned: isPinned });
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (isApiError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(undefined, { fallback: t('memo:toasts.retryLater') });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: MEMO_QUERY_KEYS.all });
    },
  });
};
