import { useFriendService, useHaptics } from '@src/bootstrap/providers/di-context';
import { findLimitedFeature } from '@src/features/billing/subscription/apis/entitlement.mapper';
import { EntitlementPolicy } from '@src/features/billing/subscription/domains/entitlement.model';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { getCachedEntitlements } from '@src/features/billing/subscription/queries/entitlement-cache';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import { InvitedFriendPolicy } from '@src/features/social/invite/domains/invited-friend.model';
import { useOpenMyInvite } from '@src/features/social/invite/hooks/use-open-my-invite';
import { getCachedInviteAvailability } from '@src/features/social/invite/queries/invite-cache';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import { match } from 'ts-pattern';

import { FRIEND_QUERY_KEYS } from '../constants/friend-query-keys';
import { isFriendError } from '../domains/friend.error';
import { FriendPolicy } from '../domains/friend.model';
import { patchSearchedUser } from './friend-cache';

export const useSendRequestByTagMutationOptions = () => {
  const haptics = useHaptics();
  const friendService = useFriendService();
  const { trackEvent, trackAttributedFeatureSuccess } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const gate = useEntitlementGate('FRIEND', { surface: 'friend_request' });
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
      if (result.autoAccepted) {
        queryClient.invalidateQueries({ queryKey: FRIEND_QUERY_KEYS.received() });
        queryClient.invalidateQueries({ queryKey: FRIEND_QUERY_KEYS.friends() });
      }
      toast.success(t('friend:toast.requestSent'));
    },
    onError: (err) => {
      haptics.notify('error');

      if (findLimitedFeature(err) != null) {
        const snapshot = getCachedEntitlements(queryClient);
        const knownLimit = snapshot == null ? null : EntitlementPolicy.getLimit(snapshot, 'FRIEND');
        const details = isApiError(err) ? err.details : undefined;
        gate.handleError(
          err,
          match(
            FriendPolicy.friendLimitDialog(
              details,
              getCachedInviteAvailability(queryClient),
              knownLimit,
            ),
          )
            .with({ type: 'invite' }, ({ limit }) => ({
              description: t('invite:entry.friendLimitDescription', {
                limit,
                activeDays: InvitedFriendPolicy.requiredActiveDays(),
              }),
              alternativeAction: {
                label: t('invite:entry.growFriendLimit'),
                onPress: () => openMyInvite('friend_limit_dialog'),
              },
            }))
            .with({ type: 'subscribe' }, () => ({}))
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
