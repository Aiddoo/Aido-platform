import type { CreateTodoInput } from '@aido/validators';
import { useTodoService } from '@src/bootstrap/providers/di-provider';
import { TODO_CATEGORY_QUERY_KEYS } from '@src/features/todo/presentations/constants/todo-category-query-keys.constant';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

export const createTodoMutationOptions = () => {
  const todoService = useTodoService();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: async (params: CreateTodoInput) => {
      const result = await todoService.createTodo(params);
      return unwrap(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: TODO_CATEGORY_QUERY_KEYS.all });
    },
  });
};
