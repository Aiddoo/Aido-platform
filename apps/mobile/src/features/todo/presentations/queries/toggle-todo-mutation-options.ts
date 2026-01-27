import type { ToggleTodoCompleteInput } from '@aido/validators';
import { useTodoService } from '@src/bootstrap/providers/di-provider';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

interface ToggleTodoMutationParams {
  todoId: number;
  body: ToggleTodoCompleteInput;
}

export const toggleTodoMutationOptions = () => {
  const todoService = useTodoService();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: ({ todoId, body }: ToggleTodoMutationParams) =>
      todoService.toggleTodoComplete(todoId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.all });
    },
  });
};
