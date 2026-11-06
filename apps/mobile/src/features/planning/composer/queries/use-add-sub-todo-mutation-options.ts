import { ErrorCode } from '@aido/api/errors';
import { useHaptics, useSubTodoService } from '@src/bootstrap/providers/di-context';
import { TODO_MUTATION_KEYS } from '@src/features/planning/todo/constants/todo-mutation-keys';
import { SubTodoPolicy } from '@src/features/planning/todo/domains/sub-todo.model';
import {
  cancelTodoCompletionQueries,
  createOptimisticId,
  settleTodoCompletionWrite,
  snapshotTodo,
  syncDailyCompletionWithList,
  updateCachedTodo,
} from '@src/features/planning/todo/queries/todo-cache';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors/api-error';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

interface AddSubTodoParams {
  todoId: number;
  title: string;
  /** 바꾼 목록의 날짜. 여러 날 할 일은 시작일이 아니라 보고 있는 날짜 목록을 고친다 */
  date: string;
}

export const useAddSubTodoMutationOptions = () => {
  const haptics = useHaptics();
  const subTodoService = useSubTodoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationKey: TODO_MUTATION_KEYS.completionWrites(),
    mutationFn: async ({ todoId, title }: AddSubTodoParams) => {
      const result = await subTodoService.addSubTodo(todoId, { title });
      return unwrap(result);
    },
    onMutate: async ({ todoId, title, date }) => {
      await cancelTodoCompletionQueries(queryClient, { date, todoId });
      const optimisticId = createOptimisticId();
      const wasCompleted = snapshotTodo(queryClient, { date, todoId })?.todo.completed ?? false;
      updateCachedTodo(queryClient, { date, todoId }, (todo) =>
        SubTodoPolicy.withSubTodoAdded(todo, {
          id: optimisticId,
          title,
          completed: false,
          sortOrder: todo.subTodos.length,
        }),
      );
      syncDailyCompletionWithList(queryClient, { date });

      return { optimisticId, wasCompleted };
    },
    onSuccess: (saved, { todoId, date }, { optimisticId }) => {
      updateCachedTodo(queryClient, { date, todoId }, (todo) =>
        SubTodoPolicy.withSubTodoConfirmed(todo, optimisticId, saved),
      );
      trackEvent('todo_item_added', { todo_id: todoId });
    },
    onError: (error, { todoId, date }, context) => {
      haptics.notify('error');

      if (isApiError(error) && error.hasCode(ErrorCode.TODO_0821)) {
        toast.error(error.message);
      } else {
        toast.error(undefined, { fallback: t('todo:toast.subTodoAddFailed') });
      }

      if (context != null) {
        updateCachedTodo(queryClient, { date, todoId }, (todo) => ({
          ...SubTodoPolicy.withSubTodoRemoved(todo, context.optimisticId),
          completed: context.wasCompleted,
        }));
        syncDailyCompletionWithList(queryClient, { date });
      }
    },
    onSettled: () => {
      settleTodoCompletionWrite(queryClient);
    },
  });
};
