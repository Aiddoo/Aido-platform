import type { CreateTodoInput } from '@aido/validators';
import { useTodoService } from '@src/bootstrap/providers/di-provider';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

export const createTodoMutationOptions = () => {
  const todoService = useTodoService();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: (params: CreateTodoInput) => todoService.createTodo(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.all });
    },
  });
};
