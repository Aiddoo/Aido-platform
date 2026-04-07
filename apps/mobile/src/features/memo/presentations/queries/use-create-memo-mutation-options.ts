import type { CreateMemoInput } from '@aido/validators';
import { useMemoService } from '@src/bootstrap/providers/di-provider';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { isMemoError } from '../../models/memo.error';
import { MEMO_QUERY_KEYS } from '../constants/memo-query-keys.constant';

export const useCreateMemoMutationOptions = () => {
  const service = useMemoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (input: CreateMemoInput) => {
      const result = await service.createMemo(input);
      return unwrap(result);
    },
    onSuccess: () => {
      toast.success('메모를 추가했어요');
      trackEvent('memo_created');
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (isMemoError(error)) {
        toast.error(error.message);
        return;
      }
      if (isApiError(error)) {
        if (error.code === 'MEMO_2003') {
          toast.error('메모 개수가 한도에 도달했어요');
          return;
        }
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
