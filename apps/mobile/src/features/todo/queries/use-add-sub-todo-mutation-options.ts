import { ErrorCode } from '@aido/api/errors';
import { useSubTodoService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors/api-error';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { notifyError } from '@src/shared/utils/haptics';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { SubTodoPolicy } from '../domains/sub-todo.model';
import {
  cancelTodoListQuery,
  createOptimisticId,
  invalidateTodoInList,
  restoreTodo,
  snapshotTodo,
  updateTodoInList,
} from './todo-cache';

interface AddSubTodoParams {
  todoId: number;
  title: string;
  startDate: string;
}

export const useAddSubTodoMutationOptions = () => {
  const subTodoService = useSubTodoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async ({ todoId, title }: AddSubTodoParams) => {
      const result = await subTodoService.addSubTodo(todoId, { title });
      return unwrap(result);
    },
    onMutate: async ({ todoId, title, startDate }) => {
      await cancelTodoListQuery(queryClient, { date: startDate });
      const snapshot = snapshotTodo(queryClient, { date: startDate, todoId });
      updateTodoInList(queryClient, { date: startDate, todoId }, (todo) =>
        SubTodoPolicy.withSubTodoAdded(todo, {
          id: createOptimisticId(),
          title,
          completed: false,
          sortOrder: todo.subTodos.length,
        }),
      );

      return { snapshot };
    },
    onSuccess: (_data, { todoId }) => {
      trackEvent('todo_item_added', { todo_id: todoId });
    },
    onError: (error, _variables, context) => {
      notifyError();

      if (isApiError(error) && error.hasCode(ErrorCode.TODO_0821)) {
        toast.error(error.message);
      } else {
        toast.error(undefined, { fallback: t('todo:toast.subTodoAddFailed') });
      }

      if (context?.snapshot) {
        restoreTodo(queryClient, context.snapshot);
      }
    },
    onSettled: (_data, _error, { todoId, startDate }) => {
      invalidateTodoInList(queryClient, { date: startDate, todoId });
    },
  });
};
