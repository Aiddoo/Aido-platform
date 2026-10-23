import { useFeatureDiscoveryStateService } from '@src/bootstrap/providers/di-context';
import {
  FEATURE_DISCOVERY_CAMPAIGN_ID,
  getBundledFeatureDiscoveryCampaign,
} from '@src/features/feature-discovery/domains/feature-discovery.registry';
import { useFeatureDiscoveryHub } from '@src/features/feature-discovery/hooks/use-feature-discovery-hub';
import { useTranslation } from '@src/shared/i18n';
import { SettingNavigation, Spacing } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import { type ComponentProps } from 'react';

import {
  type MyPageMenuPathname,
  useMyPageMenuNavigation,
} from '../../hooks/use-mypage-menu-navigation';
import { useGetMeQueryOptions } from '../../queries/get-me-query-options';

type MyPageMenuItemProps = Omit<
  ComponentProps<typeof SettingNavigation.Item>,
  'onPress' | 'className'
> & {
  pathname: MyPageMenuPathname;
};

function MyPageMenuItem({ pathname, ...props }: MyPageMenuItemProps) {
  const { navigate, isSelected } = useMyPageMenuNavigation();

  return (
    <SettingNavigation.Item
      {...props}
      className={isSelected(pathname) ? 'bg-gray-2' : undefined}
      onPress={() => navigate(pathname)}
    />
  );
}

/** 마이페이지 탭과 펼친 화면의 설정 왼쪽 pane이 함께 쓰는 이동 목록이다. */
export function MyPageMenu() {
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
    <>
      <SettingNavigation label={t('mypage.sections.activity')}>
        <MyPageMenuItem label={t('mypage.items.friends')} pathname="/friends" />
        <MyPageMenuItem
          label={t('mypage.items.categories')}
          pathname="/settings/category-settings"
        />
        <SettingNavigation.Item
          label={t('featureDiscovery:entry.mypage')}
          onPress={openFeatureGuide}
        />
        <MyPageMenuItem label={t('mypage.items.achievements')} pathname="/achievements" />
      </SettingNavigation>

      <Spacing size={12} />

      <SettingNavigation label={t('mypage.sections.subscription')}>
        <MyPageMenuItem label={t('mypage.items.aiReports')} pathname="/reports" />
        <MyPageMenuItem label={t('mypage.items.appIcon')} pathname="/settings/app-icon" />
        <MyPageMenuItem label={t('mypage.items.subscription')} pathname="/settings/subscription" />
      </SettingNavigation>

      <Spacing size={12} />

      <SettingNavigation label={t('mypage.sections.settings')}>
        <MyPageMenuItem
          label={t('mypage.items.notifications')}
          pathname="/settings/notifications"
        />
        <MyPageMenuItem label={t('mypage.items.theme')} pathname="/settings/theme" />
        <MyPageMenuItem label={t('mypage.items.fontSize')} pathname="/settings/font-size" />
        <MyPageMenuItem label={t('settings:titles.language')} pathname="/settings/language" />
      </SettingNavigation>

      <Spacing size={12} />

      <SettingNavigation>
        <MyPageMenuItem label={t('mypage.items.inquiry')} pathname="/settings/inquiry" />
        <MyPageMenuItem label={t('mypage.items.terms')} pathname="/settings/terms" />
      </SettingNavigation>
    </>
  );
}
