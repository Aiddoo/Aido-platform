import { INVITE_QUALIFICATION } from '@aido/api/vocabulary';
import { useFriendService, useHaptics } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { findLimitedFeature } from '@src/features/billing/subscription/apis/entitlement.mapper';
import { EntitlementPolicy } from '@src/features/billing/subscription/domains/entitlement.model';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { getCachedEntitlements } from '@src/features/billing/subscription/queries/entitlement-cache';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import { useTrack } from '@src/shared/analytics';
import { useMutationFailure } from '@src/shared/hooks/use-mutation-failure';
import { t } from '@src/shared/i18n';
import type { Page } from '@src/shared/types/page.types';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { mutationOptions, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { match } from 'ts-pattern';

import { FRIEND_QUERY_KEYS } from '../constants/friend-query-keys';
import { getFriendLimitFromError } from '../domains/friend.error';
import { FriendPolicy } from '../domains/friend.model';
import type { FriendUser } from '../schemas/friend.schema';
import type { ReorderFriendInput } from '../schemas/friend.schema';
import { invalidateFriends, patchSearchedUser } from './friend-cache';

export function useAcceptRequestMutationOptions() {
  const showFailure = useMutationFailure();
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
    onError: (error) => showFailure(error),
  });
}

export function useCancelRequestMutationOptions() {
  const showFailure = useMutationFailure();
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
    onError: (error) => showFailure(error),
  });
}

export function useRejectRequestMutationOptions() {
  const showFailure = useMutationFailure();
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
    onError: (error) => showFailure(error),
  });
}

export function useRemoveFriendMutationOptions() {
  const showFailure = useMutationFailure();
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
    onError: (error, _userId, context) => {
      showFailure(error);

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
}

interface ReorderFriendParams {
  followId: string;
  input: ReorderFriendInput;
}

export function useReorderFriendMutationOptions() {
  const showFailure = useMutationFailure();
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
    onError: (error) => {
      showFailure(error);
      queryClient.invalidateQueries({ queryKey: FRIEND_QUERY_KEYS.friends() });
    },
  });
}

/** `openFriendLimitInvite`는 친구 한도 안내에 덧붙일 "초대로 자리 늘리기" 길이다. 초대를 쓸 수 없으면 넘기지 않는다 */
export function useSendRequestByTagMutationOptions({
  openFriendLimitInvite,
}: { openFriendLimitInvite?: () => void } = {}) {
  const haptics = useHaptics();
  const friendService = useFriendService();
  const { trackEvent, trackAttributedFeatureSuccess } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const showFailure = useMutationFailure();
  const gate = useEntitlementGate('FRIEND', { surface: 'friend_request' });

  return mutationOptions({
    // 저장 후 떠나는 폼이라 오프라인에서도 멈춰 기다리지 않고 바로 실패해 입력값을 남긴 채 안내한다
    networkMode: 'always',
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
      if (findLimitedFeature(err) != null) {
        haptics.notify('error');
        const snapshot = getCachedEntitlements(queryClient);
        const knownLimit = snapshot == null ? null : EntitlementPolicy.getLimit(snapshot, 'FRIEND');
        gate.promptIfBlockedError(
          err,
          match(
            FriendPolicy.getFriendLimitOffer({
              isInviteAvailable: openFriendLimitInvite != null,
              serverLimit: getFriendLimitFromError(err),
              knownLimit,
            }),
          )
            .with({ type: 'invite' }, ({ limit }) =>
              openFriendLimitInvite == null
                ? {}
                : {
                    description: t('invite:entry.friendLimitDescription', {
                      limit,
                      activeDays: INVITE_QUALIFICATION.MIN_ACTIVE_DAYS,
                    }),
                    alternativeAction: {
                      label: t('invite:entry.growFriendLimit'),
                      onPress: openFriendLimitInvite,
                    },
                  },
            )
            .with({ type: 'subscribe' }, () => ({}))
            .exhaustive(),
        );
        return;
      }

      showFailure(err, t('friend:toast.requestFailed'));
    },
  });
}
