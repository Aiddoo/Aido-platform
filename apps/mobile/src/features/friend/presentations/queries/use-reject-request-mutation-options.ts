import { useFriendService } from '@src/bootstrap/providers/di-provider';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { FRIEND_QUERY_KEYS } from '../constants/friend-query-keys.constant';

export const useRejectRequestMutationOptions = () => {
  const friendService = useFriendService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (userId: string) => {
      const result = await friendService.rejectRequest(userId);
      return unwrap(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FRIEND_QUERY_KEYS.received() });
      toast.success('친구 요청을 거절했어요');
      trackEvent('friend_request_rejected');
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });
};
