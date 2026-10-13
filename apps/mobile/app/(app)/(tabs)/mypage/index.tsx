import { useFeatureDiscoveryStateService } from '@src/bootstrap/providers/di-context';
import { AppVersionCheck } from '@src/features/app-version/components/app-version-check';
import { useDeleteAccountMutationOptions } from '@src/features/auth/queries/use-delete-account-mutation-options';
import { useLogoutMutationOptions } from '@src/features/auth/queries/use-logout-mutation-options';
import {
  FEATURE_DISCOVERY_CAMPAIGN_ID,
  getBundledFeatureDiscoveryCampaign,
} from '@src/features/feature-discovery/domains/feature-discovery.registry';
import { useFeatureDiscoveryHub } from '@src/features/feature-discovery/hooks/use-feature-discovery-hub';
import { ProfileCard } from '@src/features/user/components/profile-card';
import { UserPolicy } from '@src/features/user/domains/user.model';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  H3,
  HStack,
  QueryErrorBoundary,
  SettingNavigation,
  Spacing,
  StyledSafeAreaView,
  TextButton,
  useConfirmDialog,
} from '@src/shared/ui';
import { useMutation, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Separator } from 'heroui-native';
import { Suspense } from 'react';
import { ScrollView } from 'react-native';

function MyPageScreen() {
  const push = useSingleTap(router.push);

  const { t } = useTranslation(['user', 'settings', 'featureDiscovery']);
  const { data: user } = useQuery(useGetMeQueryOptions());
  const { openHub } = useFeatureDiscoveryHub();
  const featureDiscoveryState = useFeatureDiscoveryStateService();
  const campaign = getBundledFeatureDiscoveryCampaign(FEATURE_DISCOVERY_CAMPAIGN_ID);

  const openFeatureGuide = () => {
    if (!campaign || !user) {
      return;
    }
    featureDiscoveryState.claimSeen({
      userId: user.id,
      campaignId: campaign.id,
    });
    openHub({
      accountId: user.id,
      campaign,
      source: 'mypage',
    });
  };

  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <ScrollView className="px-4 flex-1" contentContainerStyle={{ paddingBottom: 16 }}>
        <H3>{t('mypage.header')}</H3>

        <Spacing size={20} />

        <QueryErrorBoundary>
          <Suspense fallback={<ProfileCard.Loading />}>
            <ProfileCard />
          </Suspense>
        </QueryErrorBoundary>

        <Spacing size={12} />

        <SettingNavigation label={t('mypage.sections.activity')}>
          <SettingNavigation.Item
            label={t('mypage.items.friends')}
            onPress={() => push('/friends')}
          />
          <SettingNavigation.Item
            label={t('mypage.items.categories')}
            onPress={() => push('/settings/category-settings')}
          />
          <SettingNavigation.Item
            label={t('featureDiscovery:entry.mypage')}
            onPress={openFeatureGuide}
          />
          <SettingNavigation.Item
            label={t('mypage.items.achievements')}
            onPress={() => push('/achievements')}
          />
        </SettingNavigation>

        <Spacing size={12} />

        <SettingNavigation label={t('mypage.sections.subscription')}>
          <SettingNavigation.Item
            label={t('mypage.items.aiReports')}
            onPress={() => push('/reports')}
          />
          <SettingNavigation.Item
            label={t('mypage.items.appIcon')}
            onPress={() => push('/settings/app-icon')}
          />
          <SettingNavigation.Item
            label={t('mypage.items.subscription')}
            onPress={() => push('/settings/subscription')}
          />
        </SettingNavigation>

        <Spacing size={12} />

        <SettingNavigation label={t('mypage.sections.settings')}>
          <SettingNavigation.Item
            label={t('mypage.items.notifications')}
            onPress={() => push('/settings/notifications')}
          />
          <SettingNavigation.Item
            label={t('mypage.items.theme')}
            onPress={() => push('/settings/theme')}
          />
          <SettingNavigation.Item
            label={t('mypage.items.fontSize')}
            onPress={() => push('/settings/font-size')}
          />
          <SettingNavigation.Item
            label={t('settings:titles.language')}
            onPress={() => push('/settings/language')}
          />
        </SettingNavigation>

        <Spacing size={12} />

        <SettingNavigation>
          <SettingNavigation.Item
            label={t('mypage.items.inquiry')}
            onPress={() => push('/settings/inquiry')}
          />
          <SettingNavigation.Item
            label={t('mypage.items.terms')}
            onPress={() => push('/settings/terms')}
          />
        </SettingNavigation>

        <Spacing size={12} />

        <AppVersionCheck />

        <Spacing size={32} />

        <QueryErrorBoundary>
          <Suspense fallback={null}>
            <AccountActionButtons />
          </Suspense>
        </QueryErrorBoundary>
      </ScrollView>
    </StyledSafeAreaView>
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
