import { useFriendRequestService } from '@src/bootstrap/providers/di-provider';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import { FRIEND_REQUEST_QUERY_KEYS } from '../constants/friend-request-query-keys.constant';

export const acceptRequestMutationOptions = () => {
  const friendRequestService = useFriendRequestService();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: (userId: string) => friendRequestService.acceptRequest(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FRIEND_REQUEST_QUERY_KEYS.received() });
    },
  });
};
