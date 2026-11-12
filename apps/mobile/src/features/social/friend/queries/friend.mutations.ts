import { INVITE_QUALIFICATION } from '@aido/api/vocabulary';
import { useFriendApi, useHaptics } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { isLimitedFeatureError } from '@src/features/billing/subscription/domains/entitlement.error';
import { EntitlementPolicy } from '@src/features/billing/subscription/domains/entitlement.model';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import {
  getCachedEntitlements,
  invalidateEntitlements,
} from '@src/features/billing/subscription/queries/entitlement-cache';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import { useTrack } from '@src/shared/analytics';
import { t } from '@src/shared/i18n';
import { isLastMutation } from '@src/shared/query/is-last-mutation';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { findFriendLimit } from '../domains/friend.error';
import { getFriendLimit } from '../domains/friend.model';
import type { ReorderFriendInput } from '../schemas/friend-request.schema';
import {
  cancelFriendList,
  findFriendPlacement,
  getCachedFriendList,
  invalidateFriendList,
  invalidateFriends,
  invalidateFriendSearches,
  invalidateReceivedFriendRequests,
  invalidateSentFriendRequests,
  patchSearchedUser,
  updateFriendListInCache,
  withFriendRemoved,
  withFriendRestored,
} from './friend-cache';
import { FRIEND_MUTATION_KEYS } from './friend-mutation-keys';

export function useAcceptRequestMutationOptions() {
  const friendApi = useFriendApi();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    // 오프라인에 멈춘 채 나중에 실행되지 않게 바로 실패해 안내한다
    networkMode: 'always',
    mutationFn: async (userId: string) => {
      const result = await friendApi.acceptRequest(userId);
      return unwrap(result);
    },
    onSuccess: () => {
      toast.success(t('friend:toast.requestAccepted'));
      trackEvent('friend_request_accepted');
    },
    // 친구 수가 한도(FRIEND)를 써 남은 횟수도 다시 받는다. 화면에 머무는 목록이라 행이 사라질 때까지
    // 버튼을 꺼 둬 다시 눌러 요청이 또 가지 않게 한다
    onSettled: () =>
      Promise.all([invalidateEntitlements(queryClient), invalidateFriends(queryClient)]),
    meta: { errorFeedback: { feature: 'friend' } },
  });
}

export function useCancelRequestMutationOptions() {
  const friendApi = useFriendApi();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();

  return mutationOptions({
    // 오프라인에 멈춘 채 나중에 실행되지 않게 바로 실패해 안내한다
    networkMode: 'always',
    mutationFn: async (userId: string) => {
      const result = await friendApi.cancelRequest(userId);
      return unwrap(result);
    },
    onSuccess: (_data, userId) => {
      patchSearchedUser(queryClient, (user) => user.id === userId, { requestPending: false });
      trackEvent('friend_request_cancelled');
    },
    // 화면에 머무는 목록이라 행이 사라질 때까지 버튼을 꺼 둔다. 다시 눌러 요청이 또 가지 않게 한다
    onSettled: () => invalidateSentFriendRequests(queryClient),
    meta: { errorFeedback: { feature: 'friend' } },
  });
}

export function useRejectRequestMutationOptions() {
  const friendApi = useFriendApi();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    // 오프라인에 멈춘 채 나중에 실행되지 않게 바로 실패해 안내한다
    networkMode: 'always',
    mutationFn: async (userId: string) => {
      const result = await friendApi.rejectRequest(userId);
      return unwrap(result);
    },
    onSuccess: () => {
      toast.success(t('friend:toast.requestRejected'));
      trackEvent('friend_request_rejected');
    },
    // 화면에 머무는 목록이라 행이 사라질 때까지 버튼을 꺼 둔다. 다시 눌러 요청이 또 가지 않게 한다
    onSettled: () => invalidateReceivedFriendRequests(queryClient),
    meta: { errorFeedback: { feature: 'friend' } },
  });
}

export function useRemoveFriendMutationOptions() {
  const friendApi = useFriendApi();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();

  return mutationOptions({
    // 삭제 중에는 행 버튼이 꺼진다. 오프라인에 멈춰 두면 행이 빠진 채 연결될 때까지 남으니 바로 실패해 되돌린다
    networkMode: 'always',
    mutationKey: FRIEND_MUTATION_KEYS.writes(),
    mutationFn: async (userId: string) => {
      const result = await friendApi.removeFriend(userId);
      return unwrap(result);
    },
    onMutate: async (userId) => {
      await cancelFriendList(queryClient);
      const cachedFriends = getCachedFriendList(queryClient);
      const placement = cachedFriends == null ? null : findFriendPlacement(cachedFriends, userId);
      updateFriendListInCache(queryClient, (pages) => withFriendRemoved(pages, userId));
      return { placement };
    },
    onSuccess: () => {
      trackEvent('friend_removed');
    },
    // 목록을 통째로 되돌리면 함께 지우는 다른 친구가 돌아온다. 이 친구만 원래 자리에 되돌린다
    onError: (_error, _userId, context) => {
      const placement = context?.placement;
      if (placement != null) {
        updateFriendListInCache(queryClient, (pages) => withFriendRestored(pages, placement));
      }
    },
    // 친구 수가 한도(FRIEND)를 돌려받아 남은 횟수를 다시 받는다. 목록은 앞 지우기 뒤에 다시 받으면
    // 아직 지우는 중인 친구가 돌아오므로 마지막 지우기가 받는다
    onSettled: () => {
      invalidateEntitlements(queryClient);
      if (isLastMutation(queryClient, FRIEND_MUTATION_KEYS.writes())) {
        invalidateFriendList(queryClient);
        invalidateFriendSearches(queryClient);
      }
    },
    meta: { errorFeedback: { feature: 'friend' } },
  });
}

interface ReorderFriendVariables {
  followId: string;
  input: ReorderFriendInput;
}

export function useReorderFriendMutationOptions() {
  const friendApi = useFriendApi();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();

  return mutationOptions({
    // 순서를 저장하는 동안 끌기가 막힌다. 오프라인에 멈춰 두면 연결될 때까지 막히니 바로 실패해 제자리로 돌린다
    networkMode: 'always',
    mutationFn: async ({ followId, input }: ReorderFriendVariables) => {
      const result = await friendApi.reorderFriend(followId, input);
      return unwrap(result);
    },
    onSuccess: () => {
      trackEvent('friend_reordered');
    },
    // 성공하면 서버 순서로, 실패하면 끌기 전 순서로 맞춘다
    onSettled: () => invalidateFriendList(queryClient),
    meta: { errorFeedback: { feature: 'friend' } },
  });
}

/** `onFriendLimitInvite`는 친구 한도 안내에 덧붙일 "초대로 자리 늘리기" 길이다. 초대를 쓸 수 없으면 넘기지 않는다 */
export function useSendRequestByTagMutationOptions({
  onFriendLimitInvite,
}: { onFriendLimitInvite?: () => void } = {}) {
  const haptics = useHaptics();
  const friendApi = useFriendApi();
  const { trackEvent, trackAttributedFeatureSuccess } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const gate = useEntitlementGate('FRIEND', { surface: 'friend_request' });

  return mutationOptions({
    // 저장 후 떠나는 폼이라 오프라인에서도 멈춰 기다리지 않고 바로 실패해 입력값을 남긴 채 안내한다
    networkMode: 'always',
    mutationFn: async (userTag: string) => {
      const result = await friendApi.sendRequestByTag(userTag);
      return unwrap(result);
    },
    onSuccess: (result, userTag) => {
      patchSearchedUser(
        queryClient,
        (user) => user.userTag === userTag,
        result.autoAccepted ? { isFriend: true, requestPending: false } : { requestPending: true },
      );
      trackEvent('friend_request_sent');
      const accountId = getCachedMe(queryClient)?.id;
      if (accountId != null) {
        trackAttributedFeatureSuccess({ accountId, feature: 'friend_search' });
      }
      toast.success(t('friend:toast.requestSent'));
    },
    // 상대가 먼저 보낸 요청이 있어 바로 친구가 되면 받은 요청·친구 목록·한도까지 바뀐다
    onSettled: (result) => {
      invalidateSentFriendRequests(queryClient);
      if (result?.autoAccepted === true) {
        invalidateReceivedFriendRequests(queryClient);
        invalidateFriendList(queryClient);
        invalidateEntitlements(queryClient);
      }
    },
    onError: (error) => {
      if (isLimitedFeatureError(error)) {
        haptics.notify('error');
        const snapshot = getCachedEntitlements(queryClient);
        const knownLimit = snapshot == null ? null : EntitlementPolicy.getLimit(snapshot, 'FRIEND');
        gate.promptIfBlockedError(
          error,
          onFriendLimitInvite == null
            ? {}
            : {
                description: t('invite:entry.friendLimitDescription', {
                  limit: getFriendLimit({
                    serverLimit: findFriendLimit(error),
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
      }
    },
    meta: {
      errorFeedback: {
        feature: 'friend',
        fallbackKey: 'friend:toast.requestFailed',
        isHandledByFeature: isLimitedFeatureError,
      },
    },
  });
}
