import { useFeatureDiscoveryStateService } from '@src/bootstrap/providers/di-context';
import {
  FEATURE_DISCOVERY_CAMPAIGN_ID,
  filterAvailableCampaign,
  getBundledFeatureDiscoveryCampaign,
} from '@src/features/feature-discovery/domains/feature-discovery.registry';
import { useFeatureDiscoveryHub } from '@src/features/feature-discovery/hooks/use-feature-discovery-hub';
import { useInviteAvailability } from '@src/features/invite/hooks/use-invite-availability';
import { subscriptionHref } from '@src/features/subscription/utils/navigation/subscription-href';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import {
  AiIcon,
  BellIcon,
  BlockIcon,
  ChatBubbleIcon,
  CrownIcon,
  EditIcon,
  FlagIcon,
  InfoIcon,
  KoreanIcon,
  ListIcon,
  MemoIcon,
  MicIcon,
  MoonIcon,
  PawIcon,
  PersonIcon,
  SettingsCard,
  type StyledIconType,
} from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import { type ComponentProps } from 'react';

import {
  type MyPageMenuPathname,
  useMyPageMenuNavigation,
} from '../../hooks/use-mypage-menu-navigation';
import { useGetMeQueryOptions } from '../../queries/get-me-query-options';

const MENU_ICON_SIZE = 20;

type MyPageMenuItemProps = Omit<
  ComponentProps<typeof SettingsCard.Item>,
  'onPress' | 'className' | 'icon' | 'isSelected'
> & {
  pathname: MyPageMenuPathname;
  Icon: StyledIconType;
};

function MyPageMenuItem({ pathname, Icon, ...props }: MyPageMenuItemProps) {
  const { navigate, isSelected } = useMyPageMenuNavigation();

  return (
    <SettingsCard.Item
      {...props}
      icon={<MyPageMenuIcon Icon={Icon} />}
      isSelected={isSelected(pathname)}
      onPress={() => navigate(pathname)}
    />
  );
}

function MyPageMenuIcon({ Icon }: { Icon: StyledIconType }) {
  const fontScaledSize = useFontScaledSize();

  return (
    <Icon
      width={fontScaledSize(MENU_ICON_SIZE)}
      height={fontScaledSize(MENU_ICON_SIZE)}
      colorClassName="text-main"
    />
  );
}

function Activity() {
  const { t } = useTranslation(['user', 'featureDiscovery']);
  const { data: user } = useQuery(useGetMeQueryOptions());
  const { openHub } = useFeatureDiscoveryHub();
  const featureDiscoveryState = useFeatureDiscoveryStateService();
  const isInviteAvailable = useInviteAvailability();
  // 소개할 기능이 모두 꺼져 있으면 기능 가이드 항목을 숨긴다
  const campaign = filterAvailableCampaign(
    getBundledFeatureDiscoveryCampaign(FEATURE_DISCOVERY_CAMPAIGN_ID),
    { isInviteAvailable },
  );

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
    <SettingsCard label={t('mypage.sections.activity')}>
      <MyPageMenuItem Icon={PersonIcon} label={t('mypage.items.friends')} pathname="/friends" />
      <SettingsCard.Separator />
      <MyPageMenuItem
        Icon={BlockIcon}
        label={t('mypage.items.blockedUsers')}
        pathname="/settings/blocked-users"
      />
      <SettingsCard.Separator />
      <MyPageMenuItem
        Icon={ListIcon}
        label={t('mypage.items.categories')}
        pathname="/settings/category-settings"
      />
      {campaign != null && (
        <>
          <SettingsCard.Separator />
          <SettingsCard.Item
            testID="feature-guide-open"
            icon={<MyPageMenuIcon Icon={InfoIcon} />}
            label={t('featureDiscovery:entry.mypage')}
            onPress={openFeatureGuide}
          />
        </>
      )}
      <SettingsCard.Separator />
      <MyPageMenuItem
        Icon={FlagIcon}
        label={t('mypage.items.achievements')}
        pathname="/achievements"
      />
    </SettingsCard>
  );
}

function Subscription() {
  const { t } = useTranslation('user');

  return (
    <SettingsCard label={t('mypage.sections.subscription')}>
      <MyPageMenuItem Icon={AiIcon} label={t('mypage.items.aiReports')} pathname="/reports" />
      <SettingsCard.Separator />
      <MyPageMenuItem
        Icon={PawIcon}
        label={t('mypage.items.appIcon')}
        pathname="/settings/app-icon"
      />
      <SettingsCard.Separator />
      <MyPageMenuItem
        Icon={CrownIcon}
        label={t('mypage.items.subscription')}
        pathname={subscriptionHref().pathname}
      />
    </SettingsCard>
  );
}

function Settings() {
  const { t } = useTranslation(['user', 'settings']);

  return (
    <SettingsCard label={t('mypage.sections.settings')}>
      <MyPageMenuItem
        Icon={BellIcon}
        label={t('mypage.items.notifications')}
        pathname="/settings/notifications"
      />
      <SettingsCard.Separator />
      <MyPageMenuItem Icon={MoonIcon} label={t('mypage.items.theme')} pathname="/settings/theme" />
      <SettingsCard.Separator />
      <MyPageMenuItem
        Icon={EditIcon}
        label={t('mypage.items.fontSize')}
        pathname="/settings/font-size"
      />
      <SettingsCard.Separator />
      <MyPageMenuItem
        Icon={KoreanIcon}
        label={t('settings:titles.language')}
        pathname="/settings/language"
      />
      <SettingsCard.Separator />
      <MyPageMenuItem
        Icon={MicIcon}
        label={t('settings:titles.voiceStorage')}
        pathname="/settings/voice-storage"
      />
    </SettingsCard>
  );
}

function Support() {
  const { t } = useTranslation('user');

  return (
    <SettingsCard>
      <MyPageMenuItem
        Icon={ChatBubbleIcon}
        label={t('mypage.items.inquiry')}
        pathname="/settings/inquiry"
      />
      <SettingsCard.Separator />
      <MyPageMenuItem Icon={MemoIcon} label={t('mypage.items.terms')} pathname="/settings/terms" />
    </SettingsCard>
  );
}

export const MyPageMenu = { Activity, Subscription, Settings, Support };
