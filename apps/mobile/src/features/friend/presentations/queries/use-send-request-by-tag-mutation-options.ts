import { ErrorCode } from '@aido/errors';
import { useFriendService } from '@src/bootstrap/providers/di-context';
import type { User } from '@src/features/user/models/user.model';
import { USER_QUERY_KEYS } from '@src/features/user/presentations/constants/user-query-keys.constant';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { t } from '@src/shared/i18n';
import { usePremiumDialog } from '@src/shared/ui';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { isFriendError } from '../../models/friend.error';
import { FRIEND_QUERY_KEYS } from '../constants/friend-query-keys.constant';

export const useSendRequestByTagMutationOptions = () => {
  const friendService = useFriendService();
  const { trackEvent, trackAttributedFeatureSuccess } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const premiumDialog = usePremiumDialog();

  return mutationOptions({
    mutationFn: async (userTag: string) => {
      const result = await friendService.sendRequestByTag(userTag);
      return unwrap(result);
    },
    onSuccess: () => {
      trackEvent('friend_request_sent');
      const accountId = queryClient.getQueryData<User>(USER_QUERY_KEYS.me())?.id;
      if (accountId) {
        trackAttributedFeatureSuccess({ accountId, feature: 'friend_search' });
      }
      queryClient.invalidateQueries({ queryKey: FRIEND_QUERY_KEYS.sent() });
      toast.success(t('friend:toast.requestSent'));
    },
    onError: (err) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (isApiError(err) && err.hasCode(ErrorCode.FOLLOW_0909)) {
        trackEvent('premium_gate_shown', { feature: 'friend_limit' });
        premiumDialog.open({
          description: t('friend:premium.unlimitedFriends'),
        });
        return;
      }

      if (isApiError(err) || isFriendError(err)) {
        toast.error(err.message);
        return;
      }
      toast.error(undefined, { fallback: t('friend:toast.requestFailed') });
    },
  });
};
