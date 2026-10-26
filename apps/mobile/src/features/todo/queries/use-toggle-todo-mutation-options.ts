import type { ToggleTodoCompleteInput } from '@aido/api';
import { useActivationService, useTodoService } from '@src/bootstrap/providers/di-context';
import { recordTodoCompletionForActivation } from '@src/features/activation/queries/activation-cache';
import { invalidateNudgeInteractions } from '@src/features/nudge/queries/nudge-cache';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { notifyError } from '@src/shared/utils/haptics';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys';
import { useStoreReviewPrompt } from '../hooks/use-store-review-prompt';
import { cancelTodoListQuery, snapshotTodo, updateTodoInList } from './todo-cache';

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
      await cancelTodoListQuery(queryClient, { date: startDate });
      const snapshot = snapshotTodo(queryClient, { date: startDate, todoId });
      updateTodoInList(queryClient, { date: startDate, todoId }, (todo) => ({
        ...todo,
        completed: body.completed,
      }));

      return { completed: snapshot?.todo.completed, startDate };
    },
    onSuccess: (_data, variables) => {
      trackEvent('todo_completed', {
        todo_id: variables.todoId,
        is_completed: variables.body.completed,
      });
      const activationEvent = recordTodoCompletionForActivation({
        queryClient,
        service: activationService,
        isCompleted: variables.body.completed,
      });
      if (activationEvent) {
        trackEvent('activation_completed', activationEvent);
      }
      if (variables.body.completed) {
        promptAfterSuccessfulCompletion(variables.todoId);
      }
    },
    onError: (_error, variables, context) => {
      notifyError();

      const previousCompleted = context?.completed;
      // 완료 여부만 되돌려 같은 할 일의 서브투두 변경은 지키게 한다
      if (context && previousCompleted != null) {
        updateTodoInList(
          queryClient,
          { date: context.startDate, todoId: variables.todoId },
          (todo) => ({ ...todo, completed: previousCompleted }),
        );
      }
    },
    onSettled: (_data, _error, { startDate, todoId }) => {
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.listByDate({ date: startDate }) });
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.completions() });
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.details({ todoId }) });
      invalidateNudgeInteractions(queryClient);
    },
  });
};
