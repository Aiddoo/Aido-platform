import type { ConvertMemoToTodoInput } from '@aido/validators';
import { useActivationService, useMemoService } from '@src/bootstrap/providers/di-context';
import { recordTodoCreatedForActivation } from '@src/features/activation/presentations/activation-mutations';
import { TODO_QUERY_KEYS } from '@src/features/todo/presentations/constants/todo-query-keys.constant';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { MEMO_QUERY_KEYS } from '../constants/memo-query-keys.constant';

interface ConvertMemoToTodoMutationParams {
  memoId: number;
  input: ConvertMemoToTodoInput;
}

export const useConvertMemoToTodoMutationOptions = () => {
  const service = useMemoService();
  const activationService = useActivationService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async ({ memoId, input }: ConvertMemoToTodoMutationParams) => {
      const result = await service.convertToTodo(memoId, input);
      return unwrap(result);
    },
    onSuccess: (_, { memoId }) => {
      recordTodoCreatedForActivation({ queryClient, service: activationService });
      toast.success(t('memo:toasts.convertedOne'));
      trackEvent('memo_converted_to_todo', { memo_id: memoId });
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
      queryClient.invalidateQueries({ queryKey: MEMO_QUERY_KEYS.list() });
      queryClient.invalidateQueries({ queryKey: MEMO_QUERY_KEYS.resourceLimit() });
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.all });
    },
  });
};
