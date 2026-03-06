import type { UpdateTodoInput } from '@aido/validators';
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

interface UpdateTodoMutationParams {
  todoId: number;
  input: UpdateTodoInput;
}

export const useUpdateTodoMutationOptions = () => {
  const todoService = useTodoService();
  const analytics = useAnalytics();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async ({ todoId, input }: UpdateTodoMutationParams) => {
      const result = await todoService.updateTodo(todoId, input);
      return unwrap(result);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: TODO_CATEGORY_QUERY_KEYS.all });
      toast.success('할 일을 수정했어요');
      track(analytics, 'todo_edited', { todo_id: variables.todoId, field: 'general' });
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (isTodoError(error) || isApiError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(undefined, { fallback: '잠시 후 다시 수정해 보세요' });
    },
  });
};
