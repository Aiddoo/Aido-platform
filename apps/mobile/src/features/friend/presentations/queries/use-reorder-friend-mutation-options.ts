import type { ReorderFriendInput } from '@aido/validators';
import { useFriendService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics/use-track';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { FRIEND_QUERY_KEYS } from '../constants/friend-query-keys.constant';

interface ReorderFriendParams {
  followId: string;
  input: ReorderFriendInput;
}

export const useReorderFriendMutationOptions = () => {
  const friendService = useFriendService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: async ({ followId, input }: ReorderFriendParams) => {
      const result = await friendService.reorderFriend(followId, input);
      return unwrap(result);
    },
    onSuccess: () => {
      trackEvent('friend_reordered');
      queryClient.invalidateQueries({ queryKey: FRIEND_QUERY_KEYS.friends() });
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      queryClient.invalidateQueries({ queryKey: FRIEND_QUERY_KEYS.friends() });
    },
  });
};
