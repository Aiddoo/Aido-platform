import type { ToggleTodoCompleteInput } from '@aido/validators';
import { useTodoService } from '@src/bootstrap/providers/di-provider';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

interface ToggleTodoMutationParams {
  todoId: number;
  body: ToggleTodoCompleteInput;
}

export const useToggleTodoMutationOptions = () => {
  const todoService = useTodoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: async ({ todoId, body }: ToggleTodoMutationParams) => {
      const result = await todoService.toggleTodoComplete(todoId, body);
      return unwrap(result);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.all });
      trackEvent('todo_completed', {
        todo_id: variables.todoId,
        is_completed: variables.body.completed,
      });
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });
};
