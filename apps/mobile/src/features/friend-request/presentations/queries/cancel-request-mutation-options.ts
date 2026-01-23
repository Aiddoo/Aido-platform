import { useFriendRequestService } from '@src/bootstrap/providers/di-provider';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import { FRIEND_REQUEST_QUERY_KEYS } from '../constants/friend-request-query-keys.constant';

export const cancelRequestMutationOptions = () => {
  const friendRequestService = useFriendRequestService();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: (userId: string) => friendRequestService.cancelRequest(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FRIEND_REQUEST_QUERY_KEYS.sent() });
    },
  });
};
