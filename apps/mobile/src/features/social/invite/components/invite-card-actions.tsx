import { useInviteService } from '@src/bootstrap/providers/di-context';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { getNowInstant } from '@src/shared/date/instant';
import { useTranslation } from '@src/shared/i18n';
import { Box, Button, ReadableContent, StyledSafeAreaView, Text, TextButton } from '@src/shared/ui';
import { useMutation, useSuspenseQueries } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { InviteRedemptionPolicy } from '../domains/invite-redemption.model';
import { InviteRewardPolicy } from '../domains/invite-reward.model';
import { useInviteParams } from '../hooks/use-invite-params';
import { useRedeemInviteMutationOptions } from '../queries/invite.mutations';
import { useGetInvitePreviewQueryOptions } from '../queries/invite.queries';
import type { InviteCode } from '../schemas/invite.schema';

/** 초대 카드 아래 행동. 로그인 전이면 초대를 기기에 남기고 가입·로그인으로 보낸다 */
export function InviteCardActions() {
  const status = useAuthStatus();
  const [{ inviteCode, source }] = useInviteParams();
  const inviteService = useInviteService();
  const { t } = useTranslation('invite');

  if (inviteCode == null) {
    return null;
  }

  if (status === 'authenticated') {
    return <InviteCardActions.Redeem inviteCode={inviteCode} />;
  }

  const handleContinueAsGuest = (pathname: '/sign-up' | '/login') => {
    inviteService.savePendingRedemption({ inviteCode, source }, getNowInstant());
    router.push(pathname);
  };

  return (
    <StyledSafeAreaView edges={['left', 'right', 'bottom']}>
      <ReadableContent px={20} pt={12} pb={12} gap={4}>
        <Button testID="invite-card-signup" onPress={() => handleContinueAsGuest('/sign-up')}>
          {t('card.signUp')}
        </Button>

        <Box className="items-center">
          <TextButton
            testID="invite-card-login"
            size="medium"
            onPress={() => handleContinueAsGuest('/login')}
          >
            {t('card.login')}
          </TextButton>
        </Box>
      </ReadableContent>
    </StyledSafeAreaView>
  );
}

/**
 * 로그인한 사용자의 수락 버튼. 가입한 지 얼마 안 된 계정은 보상을, 오래 쓴 계정은 친구 맺기만 안내한다.
 * 최종 판정은 서버가 하고 결과는 환영 시트가 보여 준다.
 */
InviteCardActions.Redeem = function Redeem({ inviteCode }: { inviteCode: InviteCode }) {
  const { t } = useTranslation('invite');
  const inviteService = useInviteService();
  // 내 초대 정보(GET /v1/invites/me)는 처음 부르면 내 코드를 만들어 여기서 읽지 않는다.
  // 내 링크를 열었으면 서버가 INVITE_2103으로 막고 수락 오류 처리가 내 초대 화면으로 보낸다
  const [{ data: preview }, { data: me }] = useSuspenseQueries({
    queries: [useGetInvitePreviewQueryOptions({ inviteCode }), useGetMeQueryOptions()],
  });
  const redeem = useMutation(useRedeemInviteMutationOptions());
  const [now] = useState(() => getNowInstant());
  const inviterName = preview.inviter.name ?? t('card.unnamedInviter');
  const isRewardExpected = InviteRedemptionPolicy.isRewardExpected(me.createdAt, now);

  // 로그인한 본인에게 카드를 보여 줬으면 이어서 열 초대를 지운다. 닫고 나가도 다음 실행 때 다시 뜨지 않는다.
  // 로그인 화면 아래에 남은 카드는 로그인 순간 보이지 않으므로 지우지 않고, 로그인 뒤 이어서 연 카드가 지운다
  useFocusEffect(
    useCallback(() => {
      inviteService.clearPendingRedemption();
    }, [inviteService]),
  );

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
          onPress={() => redeem.mutate(inviteCode)}
          isLoading={redeem.isPending}
          isDisabled={redeem.isPending}
        >
          {isRewardExpected
            ? t('card.redeemWithReward', { count: InviteRewardPolicy.getWelcomePremiumDays() })
            : t('card.connect', { name: inviterName })}
        </Button>
      </ReadableContent>
    </StyledSafeAreaView>
  );
};
