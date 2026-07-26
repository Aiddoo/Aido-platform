import { ErrorCode } from '@aido/errors';
import type { CreateRecurringTodoInput } from '@aido/validators';
import { useTodoService } from '@src/bootstrap/providers/di-context';
import { TODO_CATEGORY_QUERY_KEYS } from '@src/features/todo/presentations/constants/todo-category-query-keys.constant';
import type { User } from '@src/features/user/models/user.model';
import { USER_QUERY_KEYS } from '@src/features/user/presentations/constants/user-query-keys.constant';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { isTodoError } from '../../models/todo.error';
import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

export interface CreateRecurringTodoParams {
  input: CreateRecurringTodoInput;
  source: 'manual' | 'ai';
}

export const useCreateRecurringTodoMutationOptions = () => {
  const todoService = useTodoService();
  const { trackEvent, trackAttributedFeatureSuccess } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async ({ input }: CreateRecurringTodoParams) => {
      const result = await todoService.createRecurringTodo(input);
      return unwrap(result);
    },
    onSuccess: (_data, { input, source }) => {
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: TODO_CATEGORY_QUERY_KEYS.all });
      toast.success(t('todo:toast.recurringAdded'));
      trackEvent('todo_created', {
        source,
        creation_entry: source === 'ai' ? 'ai_parse' : 'recurring',
        is_recurring: true,
        has_scheduled_time: !!input.scheduledTime,
        is_all_day: input.isAllDay,
        visibility: input.visibility ?? 'PUBLIC',
      });
      const accountId = queryClient.getQueryData<User>(USER_QUERY_KEYS.me())?.id;
      if (accountId) {
        trackAttributedFeatureSuccess({ accountId, feature: 'todo_creation' });
      }
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (isApiError(error) && error.hasCode(ErrorCode.TODO_0813)) {
        toast.error(t('todo:toast.recurringCategoryLimit'));
        return;
      }

      if (isTodoError(error) || isApiError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(undefined, { fallback: t('todo:toast.addFailedRetry') });
    },
  });
};
