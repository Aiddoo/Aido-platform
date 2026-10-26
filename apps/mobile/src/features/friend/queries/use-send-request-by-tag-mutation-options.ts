import { ErrorCode } from '@aido/api/errors';
import { useFriendService } from '@src/bootstrap/providers/di-context';
import { InvitedFriendPolicy } from '@src/features/invite/domains/invited-friend.model';
import { useOpenMyInvite } from '@src/features/invite/hooks/use-open-my-invite';
import { getCachedInviteAvailability } from '@src/features/invite/queries/invite-cache';
import { getCachedMe } from '@src/features/user/queries/user-cache';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { usePremiumDialog } from '@src/shared/ui';
import { notifyError } from '@src/shared/utils/haptics';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import { match } from 'ts-pattern';

import { FRIEND_QUERY_KEYS } from '../constants/friend-query-keys';
import { isFriendError } from '../domains/friend.error';
import { FriendPolicy } from '../domains/friend.model';
import { patchSearchedUser } from './friend-cache';

export const useSendRequestByTagMutationOptions = () => {
  const friendService = useFriendService();
  const { trackEvent, trackAttributedFeatureSuccess } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const premiumDialog = usePremiumDialog();
  const openMyInvite = useOpenMyInvite();

  return mutationOptions({
    mutationFn: async (userTag: string) => {
      const result = await friendService.sendRequestByTag(userTag);
      return unwrap(result);
    },
    onSuccess: (result, userTag) => {
      patchSearchedUser(
        queryClient,
        (user) => user.userTag === userTag,
        result.autoAccepted
          ? { isFriend: true, isFollowing: true, isFollower: true, requestPending: false }
          : { requestPending: true },
      );
      trackEvent('friend_request_sent');
      const accountId = getCachedMe(queryClient)?.id;
      if (accountId) {
        trackAttributedFeatureSuccess({ accountId, feature: 'friend_search' });
      }
      queryClient.invalidateQueries({ queryKey: FRIEND_QUERY_KEYS.sent() });
      toast.success(t('friend:toast.requestSent'));
    },
    onError: (err) => {
      notifyError();

      if (isApiError(err) && err.hasCode(ErrorCode.FOLLOW_0909)) {
        trackEvent('premium_gate_shown', { feature: 'friend_limit' });
        premiumDialog.open(
          match(
            FriendPolicy.friendLimitDialog(err.details, getCachedInviteAvailability(queryClient)),
          )
            .with({ type: 'invite' }, ({ limit }) => ({
              title: t('friend:premium.friendLimitTitle'),
              description: t('invite:entry.friendLimitDescription', {
                limit,
                activeDays: InvitedFriendPolicy.requiredActiveDays(),
              }),
              alternativeAction: {
                label: t('invite:entry.growFriendLimit'),
                onPress: () => openMyInvite('friend_limit_dialog'),
              },
            }))
            .with({ type: 'subscribe' }, () => ({
              description: t('friend:premium.unlimitedFriends'),
            }))
            .exhaustive(),
        );
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
