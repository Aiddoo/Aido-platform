import type { ToggleTodoCompleteInput } from '@aido/validators';
import { useTodoService } from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

interface ToggleTodoMutationParams {
  todoId: number;
  body: ToggleTodoCompleteInput;
}

export const toggleTodoMutationOptions = () => {
  const todoService = useTodoService();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: async ({ todoId, body }: ToggleTodoMutationParams) => {
      const result = await todoService.toggleTodoComplete(todoId, body);
      return unwrap(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.all });
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });
};
