import type { ReorderTodoCategoryInput } from '@aido/api';
import { useTodoCategoryService } from '@src/bootstrap/providers/di-context';
import { getCachedMe } from '@src/features/user/queries/user-cache';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { notifyError } from '@src/shared/utils/haptics';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { TODO_CATEGORY_QUERY_KEYS } from '../constants/todo-category-query-keys';
import { invalidateWidgetSummary } from './todo-cache';

interface ReorderTodoCategoryParams {
  id: number;
  input: ReorderTodoCategoryInput;
}

export const useReorderTodoCategoryMutationOptions = () => {
  const todoCategoryService = useTodoCategoryService();
  const queryClient = useQueryClient();
  const { trackEvent, trackAttributedFeatureSuccess } = useTrack();

  return mutationOptions({
    mutationFn: async ({ id, input }: ReorderTodoCategoryParams) => {
      const result = await todoCategoryService.reorderCategory(id, input);
      return unwrap(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TODO_CATEGORY_QUERY_KEYS.list() });
      invalidateWidgetSummary(queryClient);
      trackEvent('category_reordered', { source: 'settings' });
      const accountId = getCachedMe(queryClient)?.id;
      if (accountId) {
        trackAttributedFeatureSuccess({ accountId, feature: 'category_reorder' });
      }
    },
    onError: () => {
      notifyError();
      queryClient.invalidateQueries({ queryKey: TODO_CATEGORY_QUERY_KEYS.list() });
    },
  });
};
