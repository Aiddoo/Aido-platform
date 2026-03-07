import { useTodoService } from '@src/bootstrap/providers/di-provider';
import { TODO_CATEGORY_QUERY_KEYS } from '@src/features/todo/presentations/constants/todo-category-query-keys.constant';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { isTodoError } from '../../models/todo.error';
import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

interface DeleteTodoMutationParams {
  todoId: number;
  startDate: string;
}

export const useDeleteTodoMutationOptions = () => {
  const todoService = useTodoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async ({ todoId }: DeleteTodoMutationParams) => {
      const result = await todoService.deleteTodo(todoId);
      return unwrap(result);
    },
    onSuccess: (_, { startDate, todoId }) => {
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.listByDate(startDate) });
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.completions() });
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.ranges() });
      queryClient.invalidateQueries({ queryKey: TODO_CATEGORY_QUERY_KEYS.all });
      toast.success('할 일을 삭제했어요');
      trackEvent('todo_deleted', { todo_id: todoId });
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (isTodoError(error) || isApiError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(undefined, { fallback: '잠시 후 다시 삭제해 보세요' });
    },
  });
};
