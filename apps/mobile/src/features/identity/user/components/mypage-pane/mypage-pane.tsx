import { AppVersionCheck } from '@src/features/app-config/app-version/components/app-version-check';
import { QuotaSummary } from '@src/features/billing/subscription/components/quota-summary';
import { useDeleteAccountMutationOptions } from '@src/features/identity/auth/queries/use-delete-account-mutation-options';
import { useLogoutMutationOptions } from '@src/features/identity/auth/queries/use-logout-mutation-options';
import { InviteRewardCard } from '@src/features/social/invite/components/invite-reward-card';
import { useInviteAvailability } from '@src/features/social/invite/hooks/use-invite-availability';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  DocsIcon,
  H3,
  HStack,
  QueryErrorBoundary,
  Result,
  SettingsCard,
  Spacing,
  StyledSafeAreaView,
  TextButton,
  useConfirmDialog,
  VStack,
} from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Separator, Skeleton } from 'heroui-native';
import { Suspense } from 'react';

import { UserPolicy } from '../../domains/user.model';
import { useMyPageMenuNavigation } from '../../hooks/use-mypage-menu-navigation';
import { useGetMeQueryOptions } from '../../queries/get-me-query-options';
import { MyPageMenu } from '../mypage-menu/mypage-menu';
import { ProfileCard } from '../profile-card';

export function MyPagePane() {
  const { t } = useTranslation('user');
  const isInviteAvailable = useInviteAvailability();

  return (
    <>
      <H3>{t('mypage.header')}</H3>

      <Spacing size={20} />

      <VStack gap={12}>
        <QueryErrorBoundary fallback={SettingsCard.Error}>
          <Suspense fallback={<ProfileCard.Loading />}>
            <ProfileCard />
          </Suspense>
        </QueryErrorBoundary>

        {/* 사용 가능 여부를 모르거나 묻지 못했으면 카드를 그리지 않아 꺼진 기능의 스켈레톤·오류가 번쩍이지 않는다 */}
        {isInviteAvailable && (
          <QueryErrorBoundary fallback={InviteRewardCard.Error}>
            <Suspense fallback={<InviteRewardCard.Loading />}>
              <InviteRewardCard />
            </Suspense>
          </QueryErrorBoundary>
        )}

        <MyPageMenu.Activity />

        <QuotaSummary />

        <MyPageMenu.Subscription />

        <MyPageMenu.Settings />

        <MyPageMenu.Support />

        <AppVersionCheck />
      </VStack>

      <Spacing size={32} />

      <QueryErrorBoundary fallback={SettingsCard.Error}>
        <Suspense fallback={<AccountActionButtons.Loading />}>
          <AccountActionButtons />
        </Suspense>
      </QueryErrorBoundary>
    </>
  );
}

MyPagePane.Empty = function Empty() {
  const { t } = useTranslation('user');

  return (
    <StyledSafeAreaView edges={['left', 'right']} className="flex-1 bg-white px-8">
      <Result
        icon={<DocsIcon width={72} height={72} />}
        title={t('mypage.empty.title')}
        description={t('mypage.empty.description')}
      />
    </StyledSafeAreaView>
  );
};

function AccountActionButtons() {
  const { navigate } = useMyPageMenuNavigation();
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
      navigate('/settings/delete-account');
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

AccountActionButtons.Loading = function Loading() {
  return (
    <Box accessibilityState={{ busy: true }} className="items-center pb-10">
      <Skeleton className="h-5 w-40 rounded-md" />
    </Box>
  );
};
