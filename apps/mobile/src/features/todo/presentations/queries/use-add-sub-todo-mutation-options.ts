import { ErrorCode } from '@aido/errors';
import { useSubTodoService } from '@src/bootstrap/providers/di-provider';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors/api-error';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { SubTodoPolicy } from '../../models/sub-todo.model';
import type { TodosResult } from '../../models/todo.model';
import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

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
      await queryClient.cancelQueries({ queryKey: TODO_QUERY_KEYS.listByDate(startDate) });

      const previousData = queryClient.getQueryData<TodosResult>(
        TODO_QUERY_KEYS.listByDate(startDate),
      );

      queryClient.setQueryData<TodosResult>(TODO_QUERY_KEYS.listByDate(startDate), (old) => {
        if (!old) {
          return old;
        }
        return {
          ...old,
          todos: old.todos.map((todo) => {
            if (todo.id !== todoId) {
              return todo;
            }
            const optimisticSubTodo = {
              id: Math.random(),
              title,
              completed: false,
              sortOrder: todo.subTodos.length,
            };
            return {
              ...todo,
              subTodos: [...todo.subTodos, optimisticSubTodo],
              subTodoStats: SubTodoPolicy.statsAfterAdd(todo),
            };
          }),
        };
      });

      return { previousData, startDate };
    },
    onSuccess: (_data, { todoId }) => {
      trackEvent('todo_item_added', { todo_id: todoId });
    },
    onError: (error, _variables, context) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (isApiError(error) && error.hasCode(ErrorCode.TODO_0821)) {
        toast.error(error.message);
      } else {
        toast.error(undefined, { fallback: '항목 추가에 실패했어요' });
      }

      if (context) {
        queryClient.setQueryData(
          TODO_QUERY_KEYS.listByDate(context.startDate),
          context.previousData,
        );
      }
    },
    onSettled: (_data, _error, { startDate }) => {
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.listByDate(startDate) });
    },
  });
};
