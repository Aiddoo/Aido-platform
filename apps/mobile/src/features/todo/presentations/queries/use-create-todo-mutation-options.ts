import { ErrorCode } from '@aido/errors';
import type { CreateTodoInput } from '@aido/validators';
import { useAnalytics, useTodoService } from '@src/bootstrap/providers/di-provider';
import { TODO_CATEGORY_QUERY_KEYS } from '@src/features/todo/presentations/constants/todo-category-query-keys.constant';
import { track } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { isTodoError } from '../../models/todo.error';
import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

export const useCreateTodoMutationOptions = () => {
  const todoService = useTodoService();
  const analytics = useAnalytics();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (params: CreateTodoInput) => {
      const result = await todoService.createTodo(params);
      return unwrap(result);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: TODO_CATEGORY_QUERY_KEYS.all });
      toast.success('할 일을 추가했어요!');
      track(analytics, 'todo_created', {
        category_id: variables.categoryId,
        has_due_date: !!variables.startDate,
        source: 'manual',
      });
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (isApiError(error) && error.hasCode(ErrorCode.TODO_0811)) {
        toast.error(
          '이 카테고리의 할 일이 최대 한도에 도달했어요. 완료하거나 다른 카테고리로 이동해 주세요.',
        );
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
