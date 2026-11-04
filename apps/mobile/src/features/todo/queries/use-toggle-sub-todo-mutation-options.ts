import { useHaptics, useSubTodoService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { TODO_MUTATION_KEYS } from '../constants/todo-mutation-keys';
import { SubTodoPolicy } from '../domains/sub-todo.model';
import { cancelTodoQueries, settleTodoListWrite, updateCachedTodo } from './todo-cache';

interface ToggleSubTodoParams {
  todoId: number;
  subTodoId: number;
  isCompleted: boolean;
  /** 바꾼 목록의 날짜. 여러 날 할 일은 시작일이 아니라 보고 있는 날짜 목록을 고친다 */
  date: string;
}

export const useToggleSubTodoMutationOptions = () => {
  const haptics = useHaptics();
  const subTodoService = useSubTodoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationKey: TODO_MUTATION_KEYS.listWrites(),
    mutationFn: async ({ todoId, subTodoId, isCompleted }: ToggleSubTodoParams) => {
      const result = await subTodoService.updateSubTodo(todoId, subTodoId, {
        completed: isCompleted,
      });
      return unwrap(result);
    },
    onMutate: async ({ todoId, subTodoId, isCompleted, date }) => {
      await cancelTodoQueries(queryClient, { date, todoId });
      updateCachedTodo(queryClient, { date, todoId }, (todo) =>
        SubTodoPolicy.withSubTodoToggled(todo, subTodoId, isCompleted),
      );
    },
    onSuccess: (_data, { todoId, subTodoId, isCompleted }) => {
      trackEvent('todo_item_completed', {
        todo_id: todoId,
        item_id: subTodoId,
        is_completed: isCompleted,
      });
    },
    onError: (_error, { todoId, subTodoId, isCompleted, date }) => {
      haptics.notify('error');
      updateCachedTodo(queryClient, { date, todoId }, (todo) =>
        SubTodoPolicy.withSubTodoToggled(todo, subTodoId, !isCompleted),
      );
    },
    onSettled: () => {
      settleTodoListWrite(queryClient);
    },
  });
};
