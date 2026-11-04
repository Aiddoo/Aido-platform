import type { ReorderTodoInput } from '@aido/api';
import { useHaptics, useTodoService } from '@src/bootstrap/providers/di-context';
import { getCachedMe } from '@src/features/user/queries/user-cache';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { TODO_MUTATION_KEYS } from '../constants/todo-mutation-keys';
import { invalidateWidgetSummary, settleTodoListWrite } from './todo-cache';

interface ReorderTodoParams {
  id: number;
  input: ReorderTodoInput;
}

export const useReorderTodoMutationOptions = () => {
  const haptics = useHaptics();
  const todoService = useTodoService();
  const queryClient = useQueryClient();
  const { trackEvent, trackAttributedFeatureSuccess } = useTrack();

  return mutationOptions({
    mutationKey: TODO_MUTATION_KEYS.listWrites(),
    mutationFn: async ({ id, input }: ReorderTodoParams) => {
      const result = await todoService.reorderTodo(id, input);
      return unwrap(result);
    },
    onSuccess: () => {
      invalidateWidgetSummary(queryClient);
      trackEvent('todo_reordered', { source: 'feed' });
      const accountId = getCachedMe(queryClient)?.id;
      if (accountId) {
        trackAttributedFeatureSuccess({ accountId, feature: 'todo_reorder' });
      }
    },
    onError: () => {
      haptics.notify('error');
    },
    onSettled: () => {
      settleTodoListWrite(queryClient);
    },
  });
};
