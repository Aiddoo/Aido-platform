import { useHaptics, useSubTodoService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { TODO_MUTATION_KEYS } from '../constants/todo-mutation-keys';
import { SubTodoPolicy } from '../domains/sub-todo.model';
import {
  cancelTodoQueries,
  settleTodoListWrite,
  snapshotTodo,
  updateCachedTodo,
} from './todo-cache';

interface DeleteSubTodoParams {
  todoId: number;
  subTodoId: number;
  /** 바꾼 목록의 날짜. 여러 날 할 일은 시작일이 아니라 보고 있는 날짜 목록을 고친다 */
  date: string;
}

export const useDeleteSubTodoMutationOptions = () => {
  const haptics = useHaptics();
  const subTodoService = useSubTodoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationKey: TODO_MUTATION_KEYS.listWrites(),
    mutationFn: async ({ todoId, subTodoId }: DeleteSubTodoParams) => {
      const result = await subTodoService.deleteSubTodo(todoId, subTodoId);
      return unwrap(result);
    },
    onMutate: async ({ todoId, subTodoId, date }) => {
      await cancelTodoQueries(queryClient, { date, todoId });
      const subTodos = snapshotTodo(queryClient, { date, todoId })?.todo.subTodos ?? [];
      const index = subTodos.findIndex((subTodo) => subTodo.id === subTodoId);
      updateCachedTodo(queryClient, { date, todoId }, (todo) =>
        SubTodoPolicy.withSubTodoRemoved(todo, subTodoId),
      );

      return { removed: subTodos[index], index };
    },
    onSuccess: (_data, { todoId, subTodoId }) => {
      trackEvent('todo_item_deleted', { todo_id: todoId, item_id: subTodoId });
    },
    onError: (_error, { todoId, date }, context) => {
      haptics.notify('error');
      toast.error(undefined, { fallback: t('todo:toast.subTodoDeleteFailed') });
      if (context?.removed != null) {
        const { removed, index } = context;
        updateCachedTodo(queryClient, { date, todoId }, (todo) =>
          SubTodoPolicy.withSubTodoRestored(todo, removed, index),
        );
      }
    },
    onSettled: () => {
      settleTodoListWrite(queryClient);
    },
  });
};
