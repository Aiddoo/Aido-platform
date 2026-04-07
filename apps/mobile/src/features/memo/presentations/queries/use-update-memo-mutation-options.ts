import type { UpdateMemoInput } from '@aido/validators';
import { useMemoService } from '@src/bootstrap/providers/di-provider';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { isMemoError } from '../../models/memo.error';
import { MEMO_QUERY_KEYS } from '../constants/memo-query-keys.constant';

interface UpdateMemoMutationParams {
  memoId: number;
  input: UpdateMemoInput;
}

export const useUpdateMemoMutationOptions = () => {
  const service = useMemoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async ({ memoId, input }: UpdateMemoMutationParams) => {
      const result = await service.updateMemo(memoId, input);
      return unwrap(result);
    },
    onSuccess: (_, { memoId }) => {
      trackEvent('memo_updated', { memo_id: memoId });
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (isMemoError(error) || isApiError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(undefined, { fallback: '잠시 후 다시 시도해주세요' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: MEMO_QUERY_KEYS.list() });
    },
  });
};
