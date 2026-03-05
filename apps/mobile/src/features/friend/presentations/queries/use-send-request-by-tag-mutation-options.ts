import { ErrorCode } from '@aido/errors';
import { useFriendService } from '@src/bootstrap/providers/di-provider';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { usePremiumDialog } from '@src/shared/ui/PremiumDialog/PremiumDialog';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { isFriendError } from '../../models/friend.error';
import { FRIEND_QUERY_KEYS } from '../constants/friend-query-keys.constant';

export const useSendRequestByTagMutationOptions = () => {
  const friendService = useFriendService();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const premiumDialog = usePremiumDialog();

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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (isApiError(err) && err.hasCode(ErrorCode.FOLLOW_0909)) {
        premiumDialog.open({
          description: '프리미엄 구독으로 무제한 친구를 추가할 수 있어요',
        });
        return;
      }

      if (isApiError(err) || isFriendError(err)) {
        toast.error(err.message);
        return;
      }
      toast.error(undefined, { fallback: '친구 요청에 실패했어요' });
    },
  });
};
