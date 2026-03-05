import { useFriendService } from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { FRIEND_QUERY_KEYS } from '../constants/friend-query-keys.constant';

export const useAcceptRequestMutationOptions = () => {
  const friendService = useFriendService();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (userId: string) => {
      const result = await friendService.acceptRequest(userId);
      return unwrap(result);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: FRIEND_QUERY_KEYS.received() }),
        queryClient.invalidateQueries({ queryKey: FRIEND_QUERY_KEYS.sent() }),
        queryClient.invalidateQueries({ queryKey: FRIEND_QUERY_KEYS.friends() }),
      ]);
      toast.success('친구 요청을 수락했어요');
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });
};
