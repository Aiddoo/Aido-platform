import { useHaptics, useSubTodoService } from '@src/bootstrap/providers/di-context';
import { TODO_MUTATION_KEYS } from '@src/features/planning/todo/constants/todo-mutation-keys';
import { SubTodoPolicy } from '@src/features/planning/todo/domains/sub-todo.model';
import {
  cancelTodoQueries,
  settleTodoListWrite,
  snapshotTodo,
  updateCachedTodo,
} from '@src/features/planning/todo/queries/todo-cache';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

interface UpdateSubTodoParams {
  todoId: number;
  subTodoId: number;
  title: string;
  /** 바꾼 목록의 날짜. 여러 날 할 일은 시작일이 아니라 보고 있는 날짜 목록을 고친다 */
  date: string;
}

export const useUpdateSubTodoMutationOptions = () => {
  const haptics = useHaptics();
  const subTodoService = useSubTodoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationKey: TODO_MUTATION_KEYS.listWrites(),
    mutationFn: async ({ todoId, subTodoId, title }: UpdateSubTodoParams) => {
      const result = await subTodoService.updateSubTodo(todoId, subTodoId, { title });
      return unwrap(result);
    },
    onMutate: async ({ todoId, subTodoId, title, date }) => {
      await cancelTodoQueries(queryClient, { date, todoId });
      const previous = snapshotTodo(queryClient, { date, todoId })?.todo.subTodos.find(
        (subTodo) => subTodo.id === subTodoId,
      );
      updateCachedTodo(queryClient, { date, todoId }, (todo) =>
        SubTodoPolicy.withSubTodoRenamed(todo, subTodoId, title),
      );

      return { previousTitle: previous?.title };
    },
    onSuccess: (_data, { todoId, subTodoId }) => {
      trackEvent('todo_item_updated', { todo_id: todoId, item_id: subTodoId });
    },
    onError: (_error, { todoId, subTodoId, date }, context) => {
      haptics.notify('error');
      toast.error(undefined, { fallback: t('todo:toast.subTodoUpdateFailed') });
      const previousTitle = context?.previousTitle;
      if (previousTitle != null) {
        updateCachedTodo(queryClient, { date, todoId }, (todo) =>
          SubTodoPolicy.withSubTodoRenamed(todo, subTodoId, previousTitle),
        );
      }
    },
    onSettled: () => {
      settleTodoListWrite(queryClient);
    },
  });
};
