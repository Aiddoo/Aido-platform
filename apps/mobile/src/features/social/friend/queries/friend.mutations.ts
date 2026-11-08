import { INVITE_QUALIFICATION } from '@aido/api/vocabulary';
import { useFriendService, useHaptics } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { findLimitedFeature } from '@src/features/billing/subscription/domains/entitlement.error';
import { EntitlementPolicy } from '@src/features/billing/subscription/domains/entitlement.model';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { getCachedEntitlements } from '@src/features/billing/subscription/queries/entitlement-cache';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import { useTrack } from '@src/shared/analytics';
import { getUserFacingMessage } from '@src/shared/errors';
import { t } from '@src/shared/i18n';
import type { Page } from '@src/shared/types/page.types';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { mutationOptions, useQueryClient, type InfiniteData } from '@tanstack/react-query';

import { FRIEND_QUERY_KEYS } from '../constants/friend-query-keys';
import { getFriendLimitFromError } from '../domains/friend.error';
import { FriendPolicy } from '../domains/friend.model';
import type { FriendUser } from '../schemas/friend.schema';
import type { ReorderFriendInput } from '../schemas/friend.schema';
import { invalidateFriends, patchSearchedUser } from './friend-cache';

export function useAcceptRequestMutationOptions() {
  const haptics = useHaptics();
  const friendService = useFriendService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    // 오프라인에 멈춘 채 나중에 실행되지 않게 바로 실패해 안내한다
    networkMode: 'always',
    mutationFn: async (userId: string) => {
      const result = await friendService.acceptRequest(userId);
      return unwrap(result);
    },
    onSuccess: async () => {
      toast.success(t('friend:toast.requestAccepted'));
      trackEvent('friend_request_accepted');
      // 화면에 머무는 목록이라 행이 사라질 때까지 버튼을 꺼 둔다. 다시 눌러 요청이 또 가지 않게 한다
      await invalidateFriends(queryClient);
    },
    onError: (error) => {
      haptics.notify('error');
      toast.error(getUserFacingMessage(error));
    },
  });
}

export function useCancelRequestMutationOptions() {
  const haptics = useHaptics();
  const toast = useAppToast();
  const friendService = useFriendService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();

  return mutationOptions({
    // 오프라인에 멈춘 채 나중에 실행되지 않게 바로 실패해 안내한다
    networkMode: 'always',
    mutationFn: async (userId: string) => {
      const result = await friendService.cancelRequest(userId);
      return unwrap(result);
    },
    onSuccess: async (_data, userId) => {
      patchSearchedUser(queryClient, (user) => user.id === userId, { requestPending: false });
      trackEvent('friend_request_cancelled');
      // 화면에 머무는 목록이라 행이 사라질 때까지 버튼을 꺼 둔다. 다시 눌러 요청이 또 가지 않게 한다
      await queryClient.invalidateQueries({ queryKey: FRIEND_QUERY_KEYS.sent() });
    },
    onError: (error) => {
      haptics.notify('error');
      toast.error(getUserFacingMessage(error));
    },
  });
}

export function useRejectRequestMutationOptions() {
  const haptics = useHaptics();
  const friendService = useFriendService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    // 오프라인에 멈춘 채 나중에 실행되지 않게 바로 실패해 안내한다
    networkMode: 'always',
    mutationFn: async (userId: string) => {
      const result = await friendService.rejectRequest(userId);
      return unwrap(result);
    },
    onSuccess: async () => {
      toast.success(t('friend:toast.requestRejected'));
      trackEvent('friend_request_rejected');
      // 화면에 머무는 목록이라 행이 사라질 때까지 버튼을 꺼 둔다. 다시 눌러 요청이 또 가지 않게 한다
      await queryClient.invalidateQueries({ queryKey: FRIEND_QUERY_KEYS.received() });
    },
    onError: (error) => {
      haptics.notify('error');
      toast.error(getUserFacingMessage(error));
    },
  });
}

export function useRemoveFriendMutationOptions() {
  const haptics = useHaptics();
  const toast = useAppToast();
  const friendService = useFriendService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const friendsQueryKey = FRIEND_QUERY_KEYS.friends();

  type FriendsInfiniteData = InfiniteData<Page<FriendUser>, string | undefined>;

  return mutationOptions({
    // 삭제 중에는 행 버튼이 꺼진다. 오프라인에 멈춰 두면 행이 빠진 채 연결될 때까지 남으니 바로 실패해 되돌린다
    networkMode: 'always',
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
      haptics.notify('error');
      toast.error(getUserFacingMessage(error));

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
  const haptics = useHaptics();
  const toast = useAppToast();
  const friendService = useFriendService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();

  return mutationOptions({
    // 순서를 저장하는 동안 끌기가 막힌다. 오프라인에 멈춰 두면 연결될 때까지 막히니 바로 실패해 제자리로 돌린다
    networkMode: 'always',
    mutationFn: async ({ followId, input }: ReorderFriendParams) => {
      const result = await friendService.reorderFriend(followId, input);
      return unwrap(result);
    },
    onSuccess: () => {
      trackEvent('friend_reordered');
      queryClient.invalidateQueries({ queryKey: FRIEND_QUERY_KEYS.friends() });
    },
    onError: (error) => {
      haptics.notify('error');
      toast.error(getUserFacingMessage(error));
      queryClient.invalidateQueries({ queryKey: FRIEND_QUERY_KEYS.friends() });
    },
  });
}

/** `onFriendLimitInvite`는 친구 한도 안내에 덧붙일 "초대로 자리 늘리기" 길이다. 초대를 쓸 수 없으면 넘기지 않는다 */
export function useSendRequestByTagMutationOptions({
  onFriendLimitInvite,
}: { onFriendLimitInvite?: () => void } = {}) {
  const haptics = useHaptics();
  const friendService = useFriendService();
  const { trackEvent, trackAttributedFeatureSuccess } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();
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
    onError: (error) => {
      haptics.notify('error');
      if (findLimitedFeature(error) != null) {
        const snapshot = getCachedEntitlements(queryClient);
        const knownLimit = snapshot == null ? null : EntitlementPolicy.getLimit(snapshot, 'FRIEND');
        gate.promptIfBlockedError(
          error,
          onFriendLimitInvite == null
            ? {}
            : {
                description: t('invite:entry.friendLimitDescription', {
                  limit: FriendPolicy.getFriendLimit({
                    serverLimit: getFriendLimitFromError(error),
                    knownLimit,
                  }),
                  activeDays: INVITE_QUALIFICATION.MIN_ACTIVE_DAYS,
                }),
                alternativeAction: {
                  label: t('invite:entry.growFriendLimit'),
                  onPress: onFriendLimitInvite,
                },
              },
        );
        return;
      }

      toast.error(getUserFacingMessage(error), { fallback: t('friend:toast.requestFailed') });
    },
  });
}
