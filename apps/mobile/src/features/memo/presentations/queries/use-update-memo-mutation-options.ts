import type { UpdateMemoInput } from '@aido/validators';
import { useMemoService } from '@src/bootstrap/providers/di-context';
import { AI_QUERY_KEYS } from '@src/features/ai/presentations/constants/ai-query-keys.constant';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
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
      queryClient.removeQueries({ queryKey: AI_QUERY_KEYS.parseMemo(memoId) });
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (isApiError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(undefined, { fallback: '잠시 후 다시 시도해주세요' });
    },
    onSettled: (_, __, { memoId }) => {
      queryClient.invalidateQueries({ queryKey: MEMO_QUERY_KEYS.list() });
      queryClient.invalidateQueries({ queryKey: MEMO_QUERY_KEYS.detail(memoId) });
    },
  });
};
