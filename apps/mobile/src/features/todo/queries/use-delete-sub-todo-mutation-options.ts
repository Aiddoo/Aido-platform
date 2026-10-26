import { useSubTodoService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { notifyError } from '@src/shared/utils/haptics';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { SubTodoPolicy } from '../domains/sub-todo.model';
import {
  cancelTodoListQuery,
  invalidateTodoInList,
  restoreTodo,
  snapshotTodo,
  updateTodoInList,
} from './todo-cache';

interface DeleteSubTodoParams {
  todoId: number;
  subTodoId: number;
  startDate: string;
}

export const useDeleteSubTodoMutationOptions = () => {
  const subTodoService = useSubTodoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async ({ todoId, subTodoId }: DeleteSubTodoParams) => {
      const result = await subTodoService.deleteSubTodo(todoId, subTodoId);
      return unwrap(result);
    },
    onMutate: async ({ todoId, subTodoId, startDate }) => {
      await cancelTodoListQuery(queryClient, { date: startDate });
      const snapshot = snapshotTodo(queryClient, { date: startDate, todoId });
      updateTodoInList(queryClient, { date: startDate, todoId }, (todo) =>
        SubTodoPolicy.withSubTodoRemoved(todo, subTodoId),
      );

      return { snapshot };
    },
    onSuccess: (_data, { todoId, subTodoId }) => {
      trackEvent('todo_item_deleted', { todo_id: todoId, item_id: subTodoId });
    },
    onError: (_error, _variables, context) => {
      notifyError();
      toast.error(undefined, { fallback: t('todo:toast.subTodoDeleteFailed') });
      if (context?.snapshot) {
        restoreTodo(queryClient, context.snapshot);
      }
    },
    onSettled: (_data, _error, { todoId, startDate }) => {
      invalidateTodoInList(queryClient, { date: startDate, todoId });
    },
  });
};
