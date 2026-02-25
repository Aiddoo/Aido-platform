import { useSubscriptionService } from '@src/bootstrap/providers/di-provider';
import { USER_QUERY_KEYS } from '@src/features/user/presentations/constants/user-query-keys.constant';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

export const restoreMutationOptions = () => {
  const subscriptionService = useSubscriptionService();
  const queryClient = useQueryClient();
  const { success, error } = useAppToast();

  return mutationOptions({
    mutationFn: async () => {
      const result = await subscriptionService.restorePurchases();
      return unwrap(result);
    },
    onSuccess: (hasActive) => {
      if (hasActive) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        success('구매가 복원되었어요!');
      } else {
        success('복원할 구매 내역이 없어요');
      }
      // 즉시 /me 갱신
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.me() });
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      error('구매 복원에 실패했어요');
    },
  });
};
