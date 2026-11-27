import { INVITE_FRIENDSHIP, INVITEE_REWARDS } from '@aido/api/vocabulary';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { UserPolicy } from '@src/features/identity/user/domains/user.model';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { getNowInstant } from '@src/shared/date/clock';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { dismissToTab } from '@src/shared/navigation/open-entry-href';
import { writeStoredValue } from '@src/shared/storage/define-stored-value';
import { useStoredValueStorage } from '@src/shared/storage/use-stored-value';
import {
  Box,
  Button,
  ReadableContent,
  StyledSafeAreaView,
  Text,
  TextButton,
  SurfaceCard,
} from '@src/shared/ui';
import { useAppToast } from '@src/shared/ui';
import { useMutation, useSuspenseQueries } from '@tanstack/react-query';
import { type Href, useRouter } from 'expo-router';

import type { InviteCode } from '../domains/invite-code.model';
import { InviteRedemptionPolicy } from '../domains/invite-redemption.model';
import { InviteRewardPolicy } from '../domains/invite-reward.model';
import { getRedeemFailure } from '../domains/invite.error';
import type { InviteLinkSource } from '../domains/pending-redemption.model';
import { useInviteParams } from '../hooks/use-invite-params';
import { useRedeemInviteMutationOptions } from '../queries/invite.mutations';
import { useGetInvitePreviewQueryOptions } from '../queries/invite.queries';
import { pendingRedemptionStoredValue } from '../schemas/pending-redemption-storage.schema';

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
  const storage = useStoredValueStorage(pendingRedemptionStoredValue);
  const router = useRouter();
  const continueAsGuest = useSingleTap((pathname: '/sign-up' | '/login') => {
    writeStoredValue(storage, pendingRedemptionStoredValue, {
      inviteCode,
      source,
      savedAt: getNowInstant(),
    });
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

/** 최종 판정은 서버가 하고 결과는 환영 시트가 보여 준다 */
InviteCardActions.Redeem = function Redeem({ inviteCode }: { inviteCode: InviteCode }) {
  const { t } = useTranslation('invite');
  // 내 초대 정보(GET /v1/invites/me)는 처음 부르면 내 코드를 만들어 여기서 읽지 않는다
  const [{ data: preview }, { data: me }] = useSuspenseQueries({
    queries: [useGetInvitePreviewQueryOptions({ inviteCode }), useGetMeQueryOptions()],
  });
  const redeem = useMutation(useRedeemInviteMutationOptions());
  const toast = useAppToast();
  const now = useMinuteNow();
  const inviterName = preview.inviter.name ?? t('card.unnamedInviter');
  const isRewardExpected = UserPolicy.isInviteRewardExpected(me, now);

  // 이동은 호출부 콜백에 둬 화면을 떠났으면 끌려가지 않는다. isPending은 다음 렌더에야 켜져 두 번째 탭을 막지 못한다
  const handleRedeem = useSingleTap(() => {
    redeem.mutate(inviteCode, {
      onSuccess: (result) => {
        const friendId = result.inviter.userId;
        // 이미 받은 초대를 다시 수락했으면 보상을 새로 받은 것처럼 환영 시트를 띄우지 않는다
        if (InviteRedemptionPolicy.isAlreadyAccepted(result)) {
          toast.toast(t('card.alreadyAccepted'));
          leaveInviteCard({
            pathname: '/feed',
            params:
              InviteRedemptionPolicy.findFriendship(result) === INVITE_FRIENDSHIP.FRIENDS
                ? { friendId }
                : {},
          });
          return;
        }

        // 이미 친구면 축하할 것이 없어 바로 친구 할 일로 간다
        if (InviteRedemptionPolicy.isAlreadyFriends(result)) {
          leaveInviteCard({ pathname: '/feed', params: { friendId } });
          return;
        }

        leaveInviteCard({ pathname: '/invite-welcome/[friendId]', params: { friendId } });
      },
      onError: (error) => {
        // 내 링크를 연 경우에는 내 초대 화면으로 보내 친구에게 보내게 한다
        if (getRedeemFailure(error) === 'self') {
          leaveInviteCard('/friends/invite');
        }
      },
    });
  });

  return (
    <StyledSafeAreaView edges={['left', 'right', 'bottom']}>
      <ReadableContent px={20} pt={12} pb={12} gap={12}>
        {!isRewardExpected && (
          <SurfaceCard className="px-4 py-3">
            <Text size="b4" shade={7} align="center">
              {t('card.existingAccountNote')}
            </Text>
          </SurfaceCard>
        )}

        <Button
          testID="invite-card-redeem"
          onPress={handleRedeem}
          isLoading={redeem.isPending}
          isDisabled={redeem.isPending}
        >
          {isRewardExpected
            ? t('card.redeemWithReward', {
                count: InviteRewardPolicy.getPremiumDays(INVITEE_REWARDS),
              })
            : t('card.connect', { name: inviterName })}
        </Button>
      </ReadableContent>
    </StyledSafeAreaView>
  );
};

/** 카드는 루트 스택이라 replace하면 켜 둔 앱 위에 탭 묶음을 하나 더 쌓는다. 뒤로 가도 카드로 돌아오지 않는다 */
function leaveInviteCard(href: Href) {
  dismissToTab(href, { withAnchor: true });
}
