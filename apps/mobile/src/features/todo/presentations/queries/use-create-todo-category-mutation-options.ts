import { ErrorCode } from '@aido/errors';
import type { CreateTodoCategoryInput } from '@aido/validators';
import { useTodoCategoryService } from '@src/bootstrap/providers/di-provider';
import { isTodoCategoryError } from '@src/features/todo/models/todo-category.error';
import { TODO_QUERY_KEYS } from '@src/features/todo/presentations/constants/todo-query-keys.constant';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { TODO_CATEGORY_QUERY_KEYS } from '../constants/todo-category-query-keys.constant';

export const useCreateTodoCategoryMutationOptions = () => {
  const todoCategoryService = useTodoCategoryService();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (input: CreateTodoCategoryInput) => {
      const result = await todoCategoryService.createCategory(input);
      return unwrap(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TODO_CATEGORY_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.all });
      toast.success('카테고리를 추가했어요');
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      // 프리미엄 제한 에러는 컴포넌트에서 PremiumDialog로 처리
      if (isApiError(error) && error.hasCode(ErrorCode.TODO_CATEGORY_0857)) {
        return;
      }

      if (isTodoCategoryError(error) || isApiError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(undefined, { fallback: '잠시 후 다시 추가해 보세요' });
    },
  });
};
