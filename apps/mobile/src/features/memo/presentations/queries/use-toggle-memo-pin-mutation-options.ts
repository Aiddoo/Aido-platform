import { useMemoService } from '@src/bootstrap/providers/di-provider';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
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
      toast.success(isPinned ? '메모를 고정했어요' : '메모 고정을 해제했어요');
      trackEvent('memo_pin_toggled', { memo_id: memoId, is_pinned: isPinned });
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (isApiError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(undefined, { fallback: '잠시 후 다시 시도해주세요' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: MEMO_QUERY_KEYS.all });
    },
  });
};
