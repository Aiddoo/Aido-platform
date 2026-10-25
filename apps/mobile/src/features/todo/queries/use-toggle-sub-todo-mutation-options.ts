import { useSubTodoService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { notifyError } from '@src/shared/utils/haptics';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys';
import { SubTodoPolicy } from '../domains/sub-todo.model';
import { cancelTodoListQuery, restoreTodo, snapshotTodo, updateTodoInList } from './todo-cache';

interface ToggleSubTodoParams {
  todoId: number;
  subTodoId: number;
  isCompleted: boolean;
  startDate: string;
}

export const useToggleSubTodoMutationOptions = () => {
  const subTodoService = useSubTodoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: async ({ todoId, subTodoId, isCompleted }: ToggleSubTodoParams) => {
      const result = await subTodoService.updateSubTodo(todoId, subTodoId, {
        completed: isCompleted,
      });
      return unwrap(result);
    },
    onMutate: async ({ todoId, subTodoId, isCompleted, startDate }) => {
      await cancelTodoListQuery(queryClient, { date: startDate });
      const snapshot = snapshotTodo(queryClient, { date: startDate, todoId });
      updateTodoInList(queryClient, { date: startDate, todoId }, (todo) => ({
        ...todo,
        subTodos: todo.subTodos.map((subTodo) =>
          subTodo.id === subTodoId ? { ...subTodo, completed: isCompleted } : subTodo,
        ),
        subTodoStats: SubTodoPolicy.statsAfterToggle(todo, isCompleted),
      }));

      return { snapshot };
    },
    onSuccess: (_data, { todoId, subTodoId, isCompleted }) => {
      trackEvent('todo_item_completed', {
        todo_id: todoId,
        item_id: subTodoId,
        is_completed: isCompleted,
      });
    },
    onError: (_error, _variables, context) => {
      notifyError();
      if (context?.snapshot) {
        restoreTodo(queryClient, context.snapshot);
      }
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.lists() });
    },
    onSettled: (_data, _error, { todoId }) => {
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.details({ todoId }) });
    },
  });
};
