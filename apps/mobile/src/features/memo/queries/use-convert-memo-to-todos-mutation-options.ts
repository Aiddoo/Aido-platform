import type { ConvertMemoToTodosInput } from '@aido/api';
import {
  useActivationService,
  useHaptics,
  useMemoService,
} from '@src/bootstrap/providers/di-context';
import { recordTodoCreatedForActivation } from '@src/features/activation/queries/activation-cache';
import { invalidateTodos } from '@src/features/todo/queries/todo-cache';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { MEMO_QUERY_KEYS } from '../constants/memo-query-keys';

interface ConvertMemoToTodosMutationParams {
  memoId: number;
  input: ConvertMemoToTodosInput;
}

export const useConvertMemoToTodosMutationOptions = () => {
  const haptics = useHaptics();
  const service = useMemoService();
  const activationService = useActivationService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async ({ memoId, input }: ConvertMemoToTodosMutationParams) => {
      const result = await service.convertToTodos(memoId, input);
      return unwrap(result);
    },
    onSuccess: (_data, { memoId }) => {
      recordTodoCreatedForActivation({ queryClient, service: activationService });
      toast.success(t('memo:toasts.convertedOne'));
      trackEvent('memo_converted_to_todo', { memo_id: memoId });
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
      queryClient.invalidateQueries({ queryKey: MEMO_QUERY_KEYS.list() });
      queryClient.invalidateQueries({ queryKey: MEMO_QUERY_KEYS.resourceLimit() });
      invalidateTodos(queryClient);
    },
  });
};
