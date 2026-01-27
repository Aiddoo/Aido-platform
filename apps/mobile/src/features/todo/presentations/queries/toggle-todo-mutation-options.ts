import { useTodoService } from '@src/bootstrap/providers/di-provider';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import type { ToggleTodoCompleteParams } from '../../repositories/todo.repository';
import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

export const toggleTodoMutationOptions = () => {
  const todoService = useTodoService();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: (params: ToggleTodoCompleteParams) => todoService.toggleTodoComplete(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.all });
    },
  });
};
