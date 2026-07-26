import type { ConvertMemoToTodosInput } from '@aido/validators';
import { useMemoService } from '@src/bootstrap/providers/di-context';
import { TODO_QUERY_KEYS } from '@src/features/todo/presentations/constants/todo-query-keys.constant';
import type { User } from '@src/features/user/models/user.model';
import { USER_QUERY_KEYS } from '@src/features/user/presentations/constants/user-query-keys.constant';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { MEMO_QUERY_KEYS } from '../constants/memo-query-keys.constant';

interface ConvertMemoToTodosMutationParams {
  memoId: number;
  input: ConvertMemoToTodosInput;
}

export const useConvertMemoToTodosMutationOptions = () => {
  const service = useMemoService();
  const { trackEvent, trackAttributedFeatureSuccess } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async ({ memoId, input }: ConvertMemoToTodosMutationParams) => {
      const result = await service.convertToTodos(memoId, input);
      return unwrap(result);
    },
    onSuccess: (_data, { memoId, input }) => {
      toast.success(t('memo:toasts.convertedMany', { count: input.todos.length }));
      trackEvent('memo_converted_to_todos', {
        memo_id: memoId,
        todo_count: input.todos.length,
        source: 'ai',
      });
      const accountId = queryClient.getQueryData<User>(USER_QUERY_KEYS.me())?.id;
      if (accountId) {
        trackAttributedFeatureSuccess({ accountId, feature: 'memo_ai' });
      }
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
