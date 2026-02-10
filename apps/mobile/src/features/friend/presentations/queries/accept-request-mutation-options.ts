import { useFriendService } from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import { FRIEND_QUERY_KEYS } from '../constants/friend-query-keys.constant';

export const acceptRequestMutationOptions = () => {
  const friendService = useFriendService();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: async (userId: string) => {
      const result = await friendService.acceptRequest(userId);
      return unwrap(result);
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: FRIEND_QUERY_KEYS.received() }),
        queryClient.invalidateQueries({ queryKey: FRIEND_QUERY_KEYS.sent() }),
        queryClient.invalidateQueries({ queryKey: FRIEND_QUERY_KEYS.friends() }),
      ]),
  });
};
