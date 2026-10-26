import { useSubTodoService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { notifyError } from '@src/shared/utils/haptics';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import {
  cancelTodoListQuery,
  invalidateTodoInList,
  restoreTodo,
  snapshotTodo,
  updateTodoInList,
} from './todo-cache';

interface UpdateSubTodoParams {
  todoId: number;
  subTodoId: number;
  title: string;
  startDate: string;
}

export const useUpdateSubTodoMutationOptions = () => {
  const subTodoService = useSubTodoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async ({ todoId, subTodoId, title }: UpdateSubTodoParams) => {
      const result = await subTodoService.updateSubTodo(todoId, subTodoId, { title });
      return unwrap(result);
    },
    onMutate: async ({ todoId, subTodoId, title, startDate }) => {
      await cancelTodoListQuery(queryClient, { date: startDate });
      const snapshot = snapshotTodo(queryClient, { date: startDate, todoId });
      updateTodoInList(queryClient, { date: startDate, todoId }, (todo) => ({
        ...todo,
        subTodos: todo.subTodos.map((subTodo) =>
          subTodo.id === subTodoId ? { ...subTodo, title } : subTodo,
        ),
      }));

      return { snapshot };
    },
    onSuccess: (_data, { todoId, subTodoId }) => {
      trackEvent('todo_item_updated', { todo_id: todoId, item_id: subTodoId });
    },
    onError: (_error, _variables, context) => {
      notifyError();
      toast.error(undefined, { fallback: t('todo:toast.subTodoUpdateFailed') });
      if (context?.snapshot) {
        restoreTodo(queryClient, context.snapshot);
      }
    },
    onSettled: (_data, _error, { todoId, startDate }) => {
      invalidateTodoInList(queryClient, { date: startDate, todoId });
    },
  });
};
