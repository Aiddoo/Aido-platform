import { useSubTodoService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { notifyError } from '@src/shared/utils/haptics';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import {
  cancelTodoListQuery,
  invalidateTodoInList,
  restoreTodo,
  snapshotTodo,
  updateTodoInList,
} from './todo-cache';

interface ReorderSubTodosParams {
  todoId: number;
  subTodoIds: number[];
  /** 바꾼 목록의 날짜. 여러 날 할 일은 시작일이 아니라 보고 있는 날짜 목록을 고친다 */
  date: string;
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
    onMutate: async ({ todoId, subTodoIds, date }) => {
      await cancelTodoListQuery(queryClient, { date });
      const snapshot = snapshotTodo(queryClient, { date, todoId });
      updateTodoInList(queryClient, { date, todoId }, (todo) => ({
        ...todo,
        subTodos: subTodoIds
          .map((id) => todo.subTodos.find((subTodo) => subTodo.id === id))
          .filter((subTodo) => subTodo != null),
      }));

      return { snapshot, date };
    },
    onSuccess: (_data, { todoId }) => {
      trackEvent('todo_item_reordered', { todo_id: todoId });
    },
    onError: (_err, _vars, context) => {
      notifyError();
      if (context?.snapshot) {
        restoreTodo(queryClient, context.snapshot);
      }
    },
    onSettled: (_data, _error, { todoId, date }) => {
      invalidateTodoInList(queryClient, { date, todoId });
    },
  });
};
