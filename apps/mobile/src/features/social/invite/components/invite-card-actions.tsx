import { INVITE_FRIENDSHIP } from '@aido/api/vocabulary';
import { usePendingRedemptionService } from '@src/bootstrap/providers/di-context';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { getNowInstant } from '@src/shared/date/instant';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { Box, Button, ReadableContent, StyledSafeAreaView, Text, TextButton } from '@src/shared/ui';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { useMutation, useSuspenseQueries } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { INVITEE_PREMIUM_DAYS } from '../constants/invite.constants';
import type { InviteCode } from '../domains/invite-code.model';
import { InviteeUserPolicy, InviteRedemptionPolicy } from '../domains/invite-redemption.model';
import type { InviteLinkSource } from '../domains/invite-redemption.model';
import { toRedeemFailureReason } from '../domains/invite.error';
import { useInviteParams } from '../hooks/use-invite-params';
import { useRedeemInviteMutationOptions } from '../queries/invite.mutations';
import { useGetInvitePreviewQueryOptions } from '../queries/invite.queries';

/** 초대 카드 아래 행동. 로그인 전이면 초대를 기기에 남기고 가입·로그인으로 보낸다 */
export function InviteCardActions() {
  const status = useAuthStatus();
  const [{ inviteCode, source }] = useInviteParams();

  if (inviteCode == null) {
    return null;
  }

  if (status === 'authenticated') {
    return <InviteCardActions.Redeem inviteCode={inviteCode} />;
  }

  return <InviteCardActions.Guest inviteCode={inviteCode} source={source} />;
}

InviteCardActions.Guest = function Guest({
  inviteCode,
  source,
}: {
  inviteCode: InviteCode;
  source: InviteLinkSource;
}) {
  const { t } = useTranslation('invite');
  const pendingRedemptionService = usePendingRedemptionService();
  const continueAsGuest = useSingleTap((pathname: '/sign-up' | '/login') => {
    pendingRedemptionService.savePendingRedemption({ inviteCode, source }, getNowInstant());
    router.push(pathname);
  });

  return (
    <StyledSafeAreaView edges={['left', 'right', 'bottom']}>
      <ReadableContent px={20} pt={12} pb={12} gap={4}>
        <Button testID="invite-card-signup" onPress={() => continueAsGuest('/sign-up')}>
          {t('card.signUp')}
        </Button>

        <Box className="items-center">
          <TextButton
            testID="invite-card-login"
            size="medium"
            onPress={() => continueAsGuest('/login')}
          >
            {t('card.login')}
          </TextButton>
        </Box>
      </ReadableContent>
    </StyledSafeAreaView>
  );
};

/**
 * 로그인한 사용자의 수락 버튼. 가입한 지 얼마 안 된 계정은 보상을, 오래 쓴 계정은 친구 맺기만 안내한다.
 * 최종 판정은 서버가 하고 결과는 환영 시트가 보여 준다.
 */
InviteCardActions.Redeem = function Redeem({ inviteCode }: { inviteCode: InviteCode }) {
  const { t } = useTranslation('invite');
  const pendingRedemptionService = usePendingRedemptionService();
  // 내 초대 정보(GET /v1/invites/me)는 처음 부르면 내 코드를 만들어 여기서 읽지 않는다.
  // 내 링크를 열었으면 서버가 INVITE_2103으로 막고 수락 오류 처리가 내 초대 화면으로 보낸다
  const [{ data: preview }, { data: me }] = useSuspenseQueries({
    queries: [useGetInvitePreviewQueryOptions({ inviteCode }), useGetMeQueryOptions()],
  });
  const redeem = useMutation(useRedeemInviteMutationOptions());
  const toast = useAppToast();
  const now = useMinuteNow();
  const inviterName = preview.inviter.name ?? t('card.unnamedInviter');
  const isRewardExpected = InviteeUserPolicy.isRewardExpected(me, now);

  // 로그인한 본인에게 카드를 보여 줬으면 이어서 열 초대를 지운다. 닫고 나가도 다음 실행 때 다시 뜨지 않는다.
  // 로그인 화면 아래에 남은 카드는 로그인 순간 보이지 않으므로 지우지 않고, 로그인 뒤 이어서 연 카드가 지운다.
  // 그래서 수락이나 실패 쪽에서는 따로 지우지 않는다
  useFocusEffect(
    useCallback(() => {
      pendingRedemptionService.clearPendingRedemption();
    }, [pendingRedemptionService]),
  );

  // 이동은 호출부 콜백에 둔다. 재조회를 기다리는 사이 화면을 떠났으면 콜백이 불리지 않아 끌려가지 않는다
  const handleRedeem = () => {
    redeem.mutate(inviteCode, {
      onSuccess: (result) => {
        const friendId = result.inviter.userId;
        // 이미 받은 초대를 다시 수락했으면 보상을 새로 받은 것처럼 환영 시트를 띄우지 않는다
        if (InviteRedemptionPolicy.isAlreadyAccepted(result)) {
          toast.toast(t('card.alreadyAccepted'));
          router.replace({
            pathname: '/feed',
            params:
              InviteRedemptionPolicy.getFriendship(result) === INVITE_FRIENDSHIP.FRIENDS
                ? { friendId }
                : {},
          });
          return;
        }

        // 이미 친구면 축하할 것이 없어 바로 친구 할 일로 간다
        if (InviteRedemptionPolicy.isAlreadyFriends(result)) {
          router.replace({ pathname: '/feed', params: { friendId } });
          return;
        }

        router.replace({ pathname: '/invite-welcome/[friendId]', params: { friendId } });
      },
      onError: (error) => {
        // 내 링크를 연 경우에는 내 초대 화면으로 보내 친구에게 보내게 한다
        if (toRedeemFailureReason(error) === 'self') {
          router.replace('/friends/invite');
        }
      },
    });
  };

  return (
    <StyledSafeAreaView edges={['left', 'right', 'bottom']}>
      <ReadableContent px={20} pt={12} pb={12} gap={12}>
        {!isRewardExpected && (
          <Box className="rounded-2xl bg-gray-1 px-4 py-3">
            <Text size="b4" shade={7} align="center">
              {t('card.existingAccountNote')}
            </Text>
          </Box>
        )}

        <Button
          testID="invite-card-redeem"
          onPress={handleRedeem}
          isLoading={redeem.isPending}
          isDisabled={redeem.isPending}
        >
          {isRewardExpected
            ? t('card.redeemWithReward', { count: INVITEE_PREMIUM_DAYS })
            : t('card.connect', { name: inviterName })}
        </Button>
      </ReadableContent>
    </StyledSafeAreaView>
  );
};
