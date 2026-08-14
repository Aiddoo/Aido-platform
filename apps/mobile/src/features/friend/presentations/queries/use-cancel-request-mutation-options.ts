import { useFriendService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { FRIEND_QUERY_KEYS } from '../constants/friend-query-keys.constant';

export const useCancelRequestMutationOptions = () => {
  const friendService = useFriendService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();

  return mutationOptions({
    mutationFn: async (userId: string) => {
      const result = await friendService.cancelRequest(userId);
      return unwrap(result);
    },
    onSuccess: () => {
      trackEvent('friend_request_cancelled');
      queryClient.invalidateQueries({ queryKey: FRIEND_QUERY_KEYS.sent() });
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });
};
