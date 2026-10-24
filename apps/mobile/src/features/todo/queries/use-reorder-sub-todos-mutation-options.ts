import { useSubTodoService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { notifyError } from '@src/shared/utils/haptics';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys';
import { cancelTodoListQuery, restoreTodo, snapshotTodo, updateTodoInList } from './todo-cache';

interface ReorderSubTodosParams {
  todoId: number;
  subTodoIds: number[];
  startDate: string;
}

export const useReorderSubTodosMutationOptions = () => {
  const subTodoService = useSubTodoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: async ({ todoId, subTodoIds }: ReorderSubTodosParams) => {
      const result = await subTodoService.reorderSubTodos(todoId, { itemIds: subTodoIds });
      return unwrap(result);
    },
    onMutate: async ({ todoId, subTodoIds, startDate }) => {
      await cancelTodoListQuery(queryClient, { date: startDate });
      const snapshot = snapshotTodo(queryClient, { date: startDate, todoId });
      updateTodoInList(queryClient, { date: startDate, todoId }, (todo) => ({
        ...todo,
        subTodos: subTodoIds
          .map((id) => todo.subTodos.find((subTodo) => subTodo.id === id))
          .filter((subTodo) => subTodo != null),
      }));

      return { snapshot, startDate };
    },
    onSuccess: (_data, { todoId }) => {
      trackEvent('todo_item_reordered', { todo_id: todoId });
    },
    onError: (_err, _vars, context) => {
      notifyError();
      if (context?.snapshot) {
        restoreTodo(queryClient, context.snapshot);
      }
      if (context) {
        queryClient.invalidateQueries({
          queryKey: TODO_QUERY_KEYS.listByDate({ date: context.startDate }),
        });
      }
    },
  });
};
