import { useSubscriptionService } from '@src/bootstrap/providers/di-provider';
import { USER_QUERY_KEYS } from '@src/features/user/presentations/constants/user-query-keys.constant';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { isPaymentPendingError, isPurchaseCancelledError } from '../../models/subscription.error';

export const purchaseMutationOptions = () => {
  const subscriptionService = useSubscriptionService();
  const queryClient = useQueryClient();
  const { success, error } = useAppToast();

  return mutationOptions({
    mutationFn: async (identifier: string) => {
      const result = await subscriptionService.purchase(identifier);
      return unwrap(result);
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      success('구독이 완료되었어요!');
      // 웹훅 도달 대기 후 쿼리 무효화
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.me() });
      }, 2_000);
    },
    onError: (err) => {
      // 구매 취소는 조용히 무시
      if (isPurchaseCancelledError(err)) {
        return;
      }
      // 결제 승인 대기 (Ask to Buy 등)는 안내 토스트
      if (isPaymentPendingError(err)) {
        success('결제 승인 대기 중이에요. 승인 후 자동으로 반영돼요.');
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      error('구독에 실패했어요');
    },
  });
};
