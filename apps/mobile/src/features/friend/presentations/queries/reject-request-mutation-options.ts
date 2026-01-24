import { useFriendService } from '@src/bootstrap/providers/di-provider';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import { FRIEND_QUERY_KEYS } from '../constants/friend-query-keys.constant';

export const rejectRequestMutationOptions = () => {
  const friendService = useFriendService();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: (userId: string) => friendService.rejectRequest(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FRIEND_QUERY_KEYS.received() });
    },
  });
};
