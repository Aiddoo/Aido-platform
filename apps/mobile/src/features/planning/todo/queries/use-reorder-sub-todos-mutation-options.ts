import { useHaptics, useSubTodoService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { TODO_MUTATION_KEYS } from '../constants/todo-mutation-keys';
import { SubTodoPolicy } from '../domains/sub-todo.model';
import {
  cancelTodoQueries,
  settleTodoListWrite,
  snapshotTodo,
  updateCachedTodo,
} from './todo-cache';

interface ReorderSubTodosParams {
  todoId: number;
  subTodoIds: number[];
  /** 바꾼 목록의 날짜. 여러 날 할 일은 시작일이 아니라 보고 있는 날짜 목록을 고친다 */
  date: string;
}

export const useReorderSubTodosMutationOptions = () => {
  const haptics = useHaptics();
  const subTodoService = useSubTodoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationKey: TODO_MUTATION_KEYS.listWrites(),
    mutationFn: async ({ todoId, subTodoIds }: ReorderSubTodosParams) => {
      const result = await subTodoService.reorderSubTodos(todoId, { itemIds: subTodoIds });
      return unwrap(result);
    },
    onMutate: async ({ todoId, subTodoIds, date }) => {
      await cancelTodoQueries(queryClient, { date, todoId });
      const previousIds = snapshotTodo(queryClient, { date, todoId })?.todo.subTodos.map(
        (subTodo) => subTodo.id,
      );
      updateCachedTodo(queryClient, { date, todoId }, (todo) =>
        SubTodoPolicy.withSubTodosOrdered(todo, subTodoIds),
      );

      return { previousIds };
    },
    onSuccess: (_data, { todoId }) => {
      trackEvent('todo_item_reordered', { todo_id: todoId });
    },
    onError: (_err, { todoId, date }, context) => {
      haptics.notify('error');
      const previousIds = context?.previousIds;
      if (previousIds != null) {
        updateCachedTodo(queryClient, { date, todoId }, (todo) =>
          SubTodoPolicy.withSubTodosOrdered(todo, previousIds),
        );
      }
    },
    onSettled: () => {
      settleTodoListWrite(queryClient);
    },
  });
};
