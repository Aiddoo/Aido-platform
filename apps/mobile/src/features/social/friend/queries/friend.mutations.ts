import { type ReorderFriendInput } from '@aido/api';
import { useFriendService, useHaptics } from '@src/bootstrap/providers/di-context';
import { findLimitedFeature } from '@src/features/billing/subscription/apis/entitlement.mapper';
import { EntitlementPolicy } from '@src/features/billing/subscription/domains/entitlement.model';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { getCachedEntitlements } from '@src/features/billing/subscription/queries/entitlement-cache';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import { type FriendUser } from '@src/features/social/friend/domains/friend.model';
import { InvitedFriendPolicy } from '@src/features/social/invite/domains/invited-friend.model';
import { useOpenMyInvite } from '@src/features/social/invite/hooks/use-open-my-invite';
import { getCachedInviteAvailability } from '@src/features/social/invite/queries/invite-cache';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap, isBusinessError } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { type Page } from '@src/shared/types/page.types';
import { mutationOptions, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { match } from 'ts-pattern';

import { FRIEND_QUERY_KEYS } from '../constants/friend-query-keys';
import { FriendPolicy } from '../domains/friend.model';
import { invalidateFriends, patchSearchedUser } from './friend-cache';

export const useAcceptRequestMutationOptions = () => {
  const haptics = useHaptics();
  const friendService = useFriendService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (userId: string) => {
      const result = await friendService.acceptRequest(userId);
      return unwrap(result);
    },
    onSuccess: async () => {
      await invalidateFriends(queryClient);
      toast.success(t('friend:toast.requestAccepted'));
      trackEvent('friend_request_accepted');
    },
    onError: () => {
      haptics.notify('error');
    },
  });
};

export const useCancelRequestMutationOptions = () => {
  const haptics = useHaptics();
  const friendService = useFriendService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();

  return mutationOptions({
    mutationFn: async (userId: string) => {
      const result = await friendService.cancelRequest(userId);
      return unwrap(result);
    },
    onSuccess: (_data, userId) => {
      patchSearchedUser(queryClient, (user) => user.id === userId, { requestPending: false });
      trackEvent('friend_request_cancelled');
      queryClient.invalidateQueries({ queryKey: FRIEND_QUERY_KEYS.sent() });
    },
    onError: () => {
      haptics.notify('error');
    },
  });
};

export const useRejectRequestMutationOptions = () => {
  const haptics = useHaptics();
  const friendService = useFriendService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (userId: string) => {
      const result = await friendService.rejectRequest(userId);
      return unwrap(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FRIEND_QUERY_KEYS.received() });
      toast.success(t('friend:toast.requestRejected'));
      trackEvent('friend_request_rejected');
    },
    onError: () => {
      haptics.notify('error');
    },
  });
};

export const useRemoveFriendMutationOptions = () => {
  const haptics = useHaptics();
  const friendService = useFriendService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const friendsQueryKey = FRIEND_QUERY_KEYS.friends();

  type FriendsInfiniteData = InfiniteData<Page<FriendUser>, string | undefined>;

  return mutationOptions({
    mutationFn: async (userId: string) => {
      const result = await friendService.removeFriend(userId);
      return unwrap(result);
    },
    onMutate: async (userId) => {
      await queryClient.cancelQueries({ queryKey: friendsQueryKey });

      const previousData = queryClient.getQueryData<FriendsInfiniteData>(friendsQueryKey);

      queryClient.setQueryData<FriendsInfiniteData>(friendsQueryKey, (old) => {
        if (!old) {
          return old;
        }

        const exists = old.pages.some((page) => page.items.some((item) => item.id === userId));
        if (!exists) {
          return old;
        }

        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.filter((item) => item.id !== userId),
            totalCount: Math.max(0, page.totalCount - 1),
          })),
        };
      });

      return { previousData };
    },
    onError: (_error, _userId, context) => {
      haptics.notify('error');

      if (context?.previousData) {
        queryClient.setQueryData(friendsQueryKey, context.previousData);
      }
    },
    onSettled: (_data, error) => {
      if (!error) {
        trackEvent('friend_removed');
      }
      queryClient.invalidateQueries({ queryKey: friendsQueryKey });
      queryClient.invalidateQueries({ queryKey: FRIEND_QUERY_KEYS.searches() });
    },
  });
};

interface ReorderFriendParams {
  followId: string;
  input: ReorderFriendInput;
}

export const useReorderFriendMutationOptions = () => {
  const haptics = useHaptics();
  const friendService = useFriendService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: async ({ followId, input }: ReorderFriendParams) => {
      const result = await friendService.reorderFriend(followId, input);
      return unwrap(result);
    },
    onSuccess: () => {
      trackEvent('friend_reordered');
      queryClient.invalidateQueries({ queryKey: FRIEND_QUERY_KEYS.friends() });
    },
    onError: () => {
      haptics.notify('error');
      queryClient.invalidateQueries({ queryKey: FRIEND_QUERY_KEYS.friends() });
    },
  });
};

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

      toast.error(isBusinessError(err) ? err : undefined, {
        fallback: t('friend:toast.requestFailed'),
      });
    },
  });
};
