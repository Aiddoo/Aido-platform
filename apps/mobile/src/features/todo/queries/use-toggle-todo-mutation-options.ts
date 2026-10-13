import type { ToggleTodoCompleteInput } from '@aido/api';
import { useActivationService, useTodoService } from '@src/bootstrap/providers/di-context';
import { recordTodoCompletionForActivation } from '@src/features/activation/queries/activation-mutations';
import { invalidateNudgeInteractions } from '@src/features/nudge/queries/nudge-cache';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys';
import type { TodoListResult } from '../domains/todo.model';
import { useStoreReviewPrompt } from '../hooks/use-store-review-prompt';

interface ToggleTodoMutationParams {
  todoId: number;
  body: ToggleTodoCompleteInput;
  startDate: string;
}

export const useToggleTodoMutationOptions = () => {
  const todoService = useTodoService();
  const activationService = useActivationService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const { promptAfterSuccessfulCompletion } = useStoreReviewPrompt();

  return mutationOptions({
    mutationFn: async ({ todoId, body }: ToggleTodoMutationParams) => {
      const result = await todoService.toggleTodoComplete(todoId, body);
      return unwrap(result);
    },
    onMutate: async ({ todoId, body, startDate }) => {
      await queryClient.cancelQueries({ queryKey: TODO_QUERY_KEYS.listByDate(startDate) });

      const previousData = queryClient.getQueryData<TodoListResult>(
        TODO_QUERY_KEYS.listByDate(startDate),
      );

      queryClient.setQueryData<TodoListResult>(TODO_QUERY_KEYS.listByDate(startDate), (old) => {
        if (!old) {
          return old;
        }
        return {
          ...old,
          todos: old.todos.map((todo) =>
            todo.id === todoId ? { ...todo, completed: body.completed } : todo,
          ),
        };
      });

      return {
        completed: previousData?.todos.find((todo) => todo.id === todoId)?.completed,
        startDate,
      };
    },
    onSuccess: (_data, variables) => {
      trackEvent('todo_completed', {
        todo_id: variables.todoId,
        is_completed: variables.body.completed,
      });
      const activationEvent = recordTodoCompletionForActivation({
        queryClient,
        service: activationService,
        completed: variables.body.completed,
      });
      if (activationEvent) {
        trackEvent('activation_completed', activationEvent);
      }
      if (variables.body.completed) {
        promptAfterSuccessfulCompletion(variables.todoId);
      }
    },
    onError: (_error, variables, context) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      const previousCompleted = context?.completed;
      if (context && previousCompleted != null) {
        queryClient.setQueryData<TodoListResult>(
          TODO_QUERY_KEYS.listByDate(context.startDate),
          (current) =>
            current && {
              ...current,
              todos: current.todos.map((todo) =>
                todo.id === variables.todoId ? { ...todo, completed: previousCompleted } : todo,
              ),
            },
        );
      }
    },
    onSettled: (_data, _error, { startDate, todoId }) => {
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.listByDate(startDate) });
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.completions() });
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.details(todoId) });
      invalidateNudgeInteractions(queryClient);
    },
  });
};
