import { AppVersionCheck } from '@src/features/app-version/components/app-version-check';
import { useDeleteAccountMutationOptions } from '@src/features/auth/queries/use-delete-account-mutation-options';
import { useLogoutMutationOptions } from '@src/features/auth/queries/use-logout-mutation-options';
import { InviteRewardCard } from '@src/features/invite/components/invite-reward-card';
import { useInviteAvailability } from '@src/features/invite/hooks/use-invite-availability';
import { NotificationBell } from '@src/features/notification/components/notification-bell';
import { MyPageMenu } from '@src/features/user/components/mypage-menu/mypage-menu';
import { ProfileCard } from '@src/features/user/components/profile-card';
import { UserPolicy } from '@src/features/user/domains/user.model';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  H3,
  HStack,
  QueryErrorBoundary,
  Spacing,
  StyledSafeAreaView,
  TextButton,
  useConfirmDialog,
} from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Separator } from 'heroui-native';
import { Suspense } from 'react';
import { ScrollView } from 'react-native';

function MyPageScreen() {
  const { t } = useTranslation('user');

  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <NotificationBell.Toolbar />
      <ScrollView className="px-4 flex-1" contentContainerStyle={{ paddingBottom: 16 }}>
        <StyledSafeAreaView edges={['left', 'right']}>
          <H3>{t('mypage.header')}</H3>

          <Spacing size={20} />

          <QueryErrorBoundary>
            <Suspense fallback={<ProfileCard.Loading />}>
              <ProfileCard />
            </Suspense>
          </QueryErrorBoundary>

          <InviteRewardSection />

          <Spacing size={12} />

          <MyPageMenu />

          <Spacing size={12} />

          <AppVersionCheck />

          <Spacing size={32} />

          <QueryErrorBoundary>
            <Suspense fallback={null}>
              <AccountActionButtons />
            </Suspense>
          </QueryErrorBoundary>
        </StyledSafeAreaView>
      </ScrollView>
    </StyledSafeAreaView>
  );
}

/**
 * 친구 초대 카드. 다른 진입점처럼 사용 가능 여부를 모르거나 묻지 못했으면 간격까지 숨긴다.
 * 가능하다고 확인된 뒤에만 스켈레톤·오류를 보여 꺼진 기능의 오류 카드나 스켈레톤이 번쩍이지 않는다.
 * 사용 가능 여부는 홈 진입점이 먼저 불러 두어 보통 바로 정해진다.
 */
function InviteRewardSection() {
  const isInviteAvailable = useInviteAvailability();

  if (!isInviteAvailable) {
    return null;
  }

  return (
    <>
      <Spacing size={12} />
      <QueryErrorBoundary fallback={InviteRewardCard.Error}>
        <Suspense fallback={<InviteRewardCard.Loading />}>
          <InviteRewardCard />
        </Suspense>
      </QueryErrorBoundary>
    </>
  );
}

function AccountActionButtons() {
  const push = useSingleTap(router.push);

  const { t } = useTranslation(['user', 'common']);
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const logout = useMutation(useLogoutMutationOptions());
  const deleteAccount = useMutation(useDeleteAccountMutationOptions());
  const confirmDialog = useConfirmDialog();

  const handleLogoutPress = async () => {
    const isConfirmed = await confirmDialog.open({
      title: t('logout.confirmTitle'),
      description: t('logout.confirmDescription'),
      cancelLabel: t('common:actions.cancel'),
      confirmLabel: t('common:actions.confirm'),
    });
    if (isConfirmed) {
      logout.mutate();
    }
  };

  const handleWithdrawPress = async () => {
    if (UserPolicy.hasCredential(user)) {
      push('/settings/delete-account');
      return;
    }

    const isConfirmed = await confirmDialog.open({
      title: t('withdraw.confirmTitle'),
      description: t('withdraw.confirmDescription'),
      cancelLabel: t('common:actions.cancel'),
      confirmLabel: t('withdraw.confirmAction'),
      confirmColor: 'danger',
    });
    if (isConfirmed) {
      deleteAccount.mutate({});
    }
  };

  return (
    <HStack justify="center" align="center" gap={8} pb={40}>
      <TextButton size="medium" onPress={handleLogoutPress}>
        {t('logout.action')}
      </TextButton>
      <Separator orientation="vertical" className="h-3 bg-gray-6" />
      <TextButton size="medium" onPress={handleWithdrawPress}>
        {t('withdraw.action')}
      </TextButton>
    </HStack>
  );
}

export default MyPageScreen;
