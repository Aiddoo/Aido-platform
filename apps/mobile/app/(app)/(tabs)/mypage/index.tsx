import { useFeatureDiscoveryStateService } from '@src/bootstrap/providers/di-context';
import { useDeleteAccountMutationOptions } from '@src/features/auth/presentations/queries/use-delete-account-mutation-options';
import { useLogoutMutationOptions } from '@src/features/auth/presentations/queries/use-logout-mutation-options';
import {
  FEATURE_DISCOVERY_CAMPAIGN_ID,
  getBundledFeatureDiscoveryCampaign,
} from '@src/features/feature-discovery/models/feature-discovery.registry';
import { useFeatureDiscoveryHub } from '@src/features/feature-discovery/presentations/hooks/use-feature-discovery-hub';
import { UserPolicy } from '@src/features/user/models/user.model';
import { ProfileCard } from '@src/features/user/presentations/components/ProfileCard';
import { useGetMeQueryOptions } from '@src/features/user/presentations/queries/use-get-me-query-options';
import { useSingleTap } from '@src/shared/hooks/useSingleTap';
import { useTabBarHeight } from '@src/shared/hooks/useTabBarHeight';
import { useTranslation } from '@src/shared/i18n';
import {
  ConfirmDialog,
  H3,
  HStack,
  QueryErrorBoundary,
  SettingNavigation,
  Spacing,
  StyledSafeAreaView,
  TextButton,
  useOverlay,
} from '@src/shared/ui';
import { useMutation, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Separator } from 'heroui-native';
import { Suspense } from 'react';
import { ScrollView } from 'react-native';

const MyPageScreen = () => {
  const push = useSingleTap(router.push);

  const tabBarHeight = useTabBarHeight();
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
      <ScrollView className="px-4 flex-1" contentContainerStyle={{ paddingBottom: tabBarHeight }}>
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

        <Spacing size={32} />

        <QueryErrorBoundary>
          <Suspense fallback={null}>
            <AccountActionButtons />
          </Suspense>
        </QueryErrorBoundary>
      </ScrollView>
    </StyledSafeAreaView>
  );
};

export default MyPageScreen;

function AccountActionButtons() {
  const push = useSingleTap(router.push);

  const { t } = useTranslation(['user', 'common']);
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const logout = useMutation(useLogoutMutationOptions());
  const deleteAccount = useMutation(useDeleteAccountMutationOptions());
  const overlay = useOverlay();

  const handleLogoutPress = () => {
    overlay.open(({ isOpen, close, exit }) => (
      <ConfirmDialog
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            close();
            exit();
          }
        }}
        title={<ConfirmDialog.Title>{t('logout.confirmTitle')}</ConfirmDialog.Title>}
        description={
          <ConfirmDialog.Description>{t('logout.confirmDescription')}</ConfirmDialog.Description>
        }
        cancelButton={
          <ConfirmDialog.CancelButton
            onPress={() => {
              close();
              exit();
            }}
          >
            {t('common:actions.cancel')}
          </ConfirmDialog.CancelButton>
        }
        confirmButton={
          <ConfirmDialog.ConfirmButton
            onPress={() => {
              close();
              exit();
              logout.mutate();
            }}
          >
            {t('common:actions.confirm')}
          </ConfirmDialog.ConfirmButton>
        }
      />
    ));
  };

  const handleWithdrawPress = () => {
    if (UserPolicy.hasCredential(user)) {
      push('/settings/delete-account');
    } else {
      overlay.open(({ isOpen, close, exit }) => (
        <ConfirmDialog
          isOpen={isOpen}
          onOpenChange={(open) => {
            if (!open) {
              close();
              exit();
            }
          }}
          title={<ConfirmDialog.Title>{t('withdraw.confirmTitle')}</ConfirmDialog.Title>}
          description={
            <ConfirmDialog.Description>
              {t('withdraw.confirmDescription')}
            </ConfirmDialog.Description>
          }
          cancelButton={
            <ConfirmDialog.CancelButton
              onPress={() => {
                close();
                exit();
              }}
            >
              {t('common:actions.cancel')}
            </ConfirmDialog.CancelButton>
          }
          confirmButton={
            <ConfirmDialog.ConfirmButton
              color="danger"
              onPress={() => {
                close();
                exit();
                deleteAccount.mutate({});
              }}
            >
              {t('withdraw.confirmAction')}
            </ConfirmDialog.ConfirmButton>
          }
        />
      ));
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
