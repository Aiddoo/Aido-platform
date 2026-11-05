import type { CreateMemoInput } from '@aido/api';
import { useHaptics, useMemoService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { MEMO_QUERY_KEYS } from '../constants/memo-query-keys';

export const useCreateMemoMutationOptions = () => {
  const haptics = useHaptics();
  const service = useMemoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    // 오프라인에도 멈춰 기다리지 않고 바로 실패해 글자를 남긴 채 안내한다. 글자는 초안에도 있다
    networkMode: 'always',
    mutationFn: async (input: CreateMemoInput) => {
      const result = await service.createMemo(input);
      return unwrap(result);
    },
    onSuccess: () => {
      trackEvent('memo_created');
    },
    onError: (error) => {
      haptics.notify('error');

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
