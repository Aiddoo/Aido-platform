import { useFriendService } from '@src/bootstrap/providers/di-provider';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import { isFriendError } from '../../models/friend.error';
import { FRIEND_QUERY_KEYS } from '../constants/friend-query-keys.constant';

export const sendRequestByTagMutationOptions = () => {
  const friendService = useFriendService();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (userTag: string) => {
      const result = await friendService.sendRequestByTag(userTag);
      return unwrap(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FRIEND_QUERY_KEYS.sent() });
      toast.success('친구 요청을 보냈어요');
    },
    onError: (err) => {
      if (isApiError(err) || isFriendError(err)) {
        toast.error(err.message);
        return;
      }
      toast.error(undefined, { fallback: '친구 요청에 실패했어요' });
    },
  });
};
