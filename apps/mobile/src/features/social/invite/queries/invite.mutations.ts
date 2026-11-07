import {
  useHaptics,
  useInviteService,
  useLogger,
  useInviteShareService,
} from '@src/bootstrap/providers/di-context';
import { isBusinessError, unwrap } from '@src/core/errors/result';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import { useTrack } from '@src/shared/analytics';
import { getErrorMessage, getUserFacingMessage } from '@src/shared/errors';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { INVITE_LOG_EVENT } from '../constants/invite-log-events';
import { INVITE_QUERY_KEYS } from '../constants/invite-query-keys';
import { InviteRedemptionPolicy } from '../domains/invite-redemption.model';
import { isInviteRotateRejectedError, toRedeemFailureReason } from '../domains/invite.error';
import type { InviteShareContent } from '../schemas/invite-share.schema';
import type { InviteShareChannel } from '../schemas/invite-share.schema';
import type { InviteCode } from '../schemas/invite.schema';
import { invalidateAfterRedeem, storeRedemptionResult, replaceMyInvite } from './invite-cache';

/** 코드 입력에서 없는 코드를 바로 알리고, 받은 미리보기는 초대 카드가 다시 부르지 않게 캐시에 둔다 */
export function useCheckInvitePreviewMutationOptions() {
  const inviteService = useInviteService();
  const queryClient = useQueryClient();

  return mutationOptions({
    // 보내는 사이 연결이 끊겨도 멈추지 않고 실패해 호출한 쪽이 알린다
    networkMode: 'always',
    mutationFn: async (inviteCode: InviteCode) => {
      const result = await inviteService.getPreview(inviteCode);
      if (!result.ok) {
        inviteService.clearPendingRedemptionIfTerminal(inviteCode, result.error);
      }
      return unwrap(result);
    },
    onSuccess: (preview, inviteCode) => {
      queryClient.setQueryData(INVITE_QUERY_KEYS.preview({ inviteCode }), preview);
    },
  });
}

export function useRedeemInviteMutationOptions() {
  const haptics = useHaptics();
  const inviteService = useInviteService();
  const logger = useLogger();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const { trackEvent } = useTrack();

  return mutationOptions({
    // 오프라인에 멈춰 있다가 나중에 수락되지 않게 바로 실패해 경계가 알린다
    networkMode: 'always',
    mutationFn: async (inviteCode: InviteCode) => unwrap(await inviteService.redeem(inviteCode)),
    // 내 정보를 다시 받을 때까지 기다린 뒤 끝나야 환영 시트가 이어 붙은 보상 기간을 보인다(그동안 버튼은 isPending)
    onSuccess: async (result, inviteCode) => {
      trackEvent('invite_redeemed', {
        outcome: result.outcome,
        friendship: InviteRedemptionPolicy.getFriendship(result) ?? 'NONE',
      });
      storeRedemptionResult(queryClient, result);
      await invalidateAfterRedeem(queryClient, { inviteCode }).catch((error) =>
        logger.warn(INVITE_LOG_EVENT.POST_REDEEM_REFRESH_FAILED, { error: getErrorMessage(error) }),
      );
      haptics.notify('success');
    },
    onError: (redeemError) => {
      // 오류 경계로 가는 장애는 토스트를 함께 띄우지 않는다
      if (!isBusinessError(redeemError)) {
        return;
      }

      trackEvent('invite_redeem_failed', { reason: toRedeemFailureReason(redeemError) });
      haptics.notify('error');
      toast.error(getUserFacingMessage(redeemError));
    },
    // 네트워크·서버 장애는 화면 오류 경계가 맡는다
    throwOnError: (redeemError) => !isBusinessError(redeemError),
  });
}

export function useRotateInviteCodeMutationOptions() {
  const haptics = useHaptics();
  const inviteService = useInviteService();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    // 오프라인에 멈춘 채 나중에 코드가 바뀌지 않게 바로 실패해 경계가 알린다
    networkMode: 'always',
    mutationFn: async () => unwrap(await inviteService.rotateInviteCode()),
    onSuccess: (myInvite) => {
      replaceMyInvite(queryClient, myInvite);
      haptics.notify('success');
      toast.success(t('invite:toast.rotated'));
    },
    onError: (rotateError) => {
      if (isInviteRotateRejectedError(rotateError)) {
        haptics.notify('error');
        toast.error(getUserFacingMessage(rotateError));
      }
    },
    // 네트워크·서버 장애는 화면 오류 경계가 맡는다
    throwOnError: (rotateError) => !isInviteRotateRejectedError(rotateError),
  });
}

interface ShareInviteVariables {
  channel: InviteShareChannel;
  content: InviteShareContent;
}

export function useShareInviteMutationOptions() {
  const haptics = useHaptics();
  const inviteShareService = useInviteShareService();
  const toast = useAppToast();
  const { trackEvent, trackAttributedFeatureSuccess } = useTrack();
  const queryClient = useQueryClient();

  return mutationOptions({
    // 기기 안에서만 처리해 연결 상태와 무관하다
    networkMode: 'always',
    mutationFn: ({ channel, content }: ShareInviteVariables) =>
      inviteShareService.share(channel, content),
    onSuccess: ({ channel, outcome }) => {
      if (outcome !== 'dismissed') {
        trackEvent('invite_link_shared', { channel });
        const accountId = getCachedMe(queryClient)?.id;
        if (accountId != null) {
          trackAttributedFeatureSuccess({ accountId, feature: 'friend_invite' });
        }
      }

      if (outcome === 'copied') {
        haptics.notify('success');
        toast.success(t('invite:toast.linkCopied'));
      }
    },
    // 복사까지 실패하면 다시 시도하게만 알린다(공유는 화면 상태를 바꾸지 않는다)
    onError: () => {
      haptics.notify('error');
      toast.error(t('invite:toast.shareFailed'));
    },
  });
}
