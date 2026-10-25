import { useInviteService } from '@src/bootstrap/providers/di-context';
import { createFeedHref } from '@src/features/todo/utils/feed-route';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { notifyError, notifySuccess } from '@src/shared/utils/haptics';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { router } from 'expo-router';
import { match } from 'ts-pattern';

import { InviteRedemptionPolicy } from '../domains/invite-redemption.model';
import {
  isInviteError,
  isTerminalRedeemFailure,
  toRedeemFailureReason,
} from '../domains/invite.error';
import type { InviteCode } from '../domains/invite.model';
import { inviteWelcomeSheetHref, myInviteHref } from '../utils/navigation/invite-href';
import { invalidateAfterRedeem, storeRedemptionResult } from './invite-cache';

export function useRedeemInviteMutationOptions() {
  const inviteService = useInviteService();
  const queryClient = useQueryClient();
  const { error: showError } = useAppToast();
  const { trackEvent } = useTrack();

  return mutationOptions({
    mutationFn: async (inviteCode: InviteCode) => unwrap(await inviteService.redeem(inviteCode)),
    // 내 정보를 다시 받을 때까지 기다린 뒤 넘어가야 환영 시트가 이어 붙은 보상 기간을 보인다(그동안 버튼은 isPending)
    onSuccess: async (result, inviteCode) => {
      inviteService.clearPendingRedemption();
      trackEvent('invite_redeemed', {
        outcome: result.outcome,
        friendship: InviteRedemptionPolicy.friendship(result) ?? 'NONE',
      });
      storeRedemptionResult(queryClient, result);
      await invalidateAfterRedeem(queryClient, { inviteCode }).catch(noop);
      notifySuccess();

      // 이미 친구면 축하할 것이 없어 바로 친구 할 일로 간다
      match(InviteRedemptionPolicy.welcomeVariant(result))
        .with('already-friends', () =>
          router.replace(createFeedHref({ friendId: result.inviter.userId })),
        )
        .with(
          'friends-with-reward',
          'requested-with-reward',
          'friends-only',
          'requested-only',
          () => router.replace(inviteWelcomeSheetHref(result.inviter.userId)),
        )
        .exhaustive();
    },
    onError: (redeemError) => {
      // 오류 경계로 가는 장애는 토스트를 함께 띄우지 않는다
      if (!isBusinessRedeemError(redeemError)) {
        return;
      }

      const reason = toRedeemFailureReason(redeemError);
      trackEvent('invite_redeem_failed', { reason });
      notifyError();
      showError(redeemError.message);

      if (isTerminalRedeemFailure(reason)) {
        inviteService.clearPendingRedemption();
      }

      match(reason)
        // 내 링크를 연 경우에는 내 초대 화면으로 보내 친구에게 보내게 한다
        .with('self', () => router.replace(myInviteHref()))
        .with(
          'invalid_code',
          'not_found',
          'rotated',
          'already_redeemed',
          'disabled',
          'friend_limit',
          'blocked',
          'unknown',
          () => undefined,
        )
        .exhaustive();
    },
    // 네트워크·서버 장애는 화면 오류 경계가 맡는다
    throwOnError: (redeemError) => !isBusinessRedeemError(redeemError),
  });
}

function isBusinessRedeemError(error: unknown) {
  return isApiError(error) || isInviteError(error);
}
