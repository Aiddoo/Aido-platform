import type { ReorderTodoCategoryInput } from '@aido/api';
import { useTodoCategoryService } from '@src/bootstrap/providers/di-context';
import { USER_QUERY_KEYS } from '@src/features/user/constants/user-query-keys';
import type { User } from '@src/features/user/domains/user.model';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { TODO_CATEGORY_QUERY_KEYS } from '../constants/todo-category-query-keys';

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
      trackEvent('category_reordered', { source: 'settings' });
      const accountId = queryClient.getQueryData<User>(USER_QUERY_KEYS.me())?.id;
      if (accountId) {
        trackAttributedFeatureSuccess({ accountId, feature: 'category_reorder' });
      }
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      queryClient.invalidateQueries({ queryKey: TODO_CATEGORY_QUERY_KEYS.list() });
    },
  });
};
