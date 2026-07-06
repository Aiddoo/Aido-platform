import { ErrorCode } from '@aido/errors';
import type { CreateRecurringTodoInput } from '@aido/validators';
import { useTodoService } from '@src/bootstrap/providers/di-context';
import { TODO_CATEGORY_QUERY_KEYS } from '@src/features/todo/presentations/constants/todo-category-query-keys.constant';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
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
  const { trackEvent } = useTrack();
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
      toast.success('반복 할 일을 추가했어요!');
      trackEvent('todo_created', {
        source,
        is_recurring: true,
        has_scheduled_time: !!input.scheduledTime,
        is_all_day: input.isAllDay,
        visibility: input.visibility ?? 'PUBLIC',
      });
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (isApiError(error) && error.hasCode(ErrorCode.TODO_0813)) {
        toast.error('반복 할 일을 생성하면 카테고리 한도를 초과해요. 날짜 범위를 줄여주세요.');
        return;
      }

      if (isTodoError(error) || isApiError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(undefined, { fallback: '잠시 후 다시 추가해 보세요' });
    },
  });
};
