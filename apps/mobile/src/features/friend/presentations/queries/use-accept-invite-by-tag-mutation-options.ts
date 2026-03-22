import { ErrorCode } from '@aido/errors';
import { useFriendService } from '@src/bootstrap/providers/di-provider';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { usePremiumDialog } from '@src/shared/ui';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { isFriendError } from '../../models/friend.error';
import { FRIEND_QUERY_KEYS } from '../constants/friend-query-keys.constant';

export const useAcceptInviteByTagMutationOptions = () => {
  const friendService = useFriendService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const premiumDialog = usePremiumDialog();

  return mutationOptions({
    mutationFn: async (userTag: string) => {
      const result = await friendService.acceptInviteByTag(userTag);
      return unwrap(result);
    },
    onSuccess: (data, userTag) => {
      trackEvent('invite_friend_request_sent', { userTag, autoAccepted: data.autoAccepted });
      queryClient.invalidateQueries({ queryKey: FRIEND_QUERY_KEYS.all });
      toast.success('\uCE5C\uAD6C\uAC00 \uB418\uC5C8\uC5B4\uC694!');
    },
    onError: (err) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (isApiError(err) && err.hasCode(ErrorCode.FOLLOW_0909)) {
        trackEvent('premium_gate_shown', { feature: 'friend_limit' });
        premiumDialog.open({
          description:
            '\uD504\uB9AC\uBBF8\uC5C4 \uAD6C\uB3C5\uC73C\uB85C \uBB34\uC81C\uD55C \uCE5C\uAD6C\uB97C \uCD94\uAC00\uD560 \uC218 \uC788\uC5B4\uC694',
        });
        return;
      }

      if (isApiError(err) || isFriendError(err)) {
        toast.error(err.message);
        return;
      }

      toast.error(undefined, {
        fallback: '\uCD08\uB300 \uCC98\uB9AC\uC5D0 \uC2E4\uD328\uD588\uC5B4\uC694',
      });
    },
  });
};
