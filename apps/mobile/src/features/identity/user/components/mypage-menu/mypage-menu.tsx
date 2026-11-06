import { useWhatsNewRepository } from '@src/bootstrap/providers/di-context';
import { WHATS_NEW_CAMPAIGN_ID } from '@src/features/app-config/feature-campaign/constants/feature-campaign.constants';
import {
  filterAvailableCampaign,
  getBundledWhatsNewCampaign,
} from '@src/features/app-config/whats-new/domains/whats-new.registry';
import { useWhatsNewHub } from '@src/features/app-config/whats-new/hooks/use-whats-new-hub';
import { useInviteAvailability } from '@src/features/social/invite/hooks/use-invite-availability';
import { toInstant } from '@src/shared/date/instant';
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
import { useGetMeQueryOptions } from '../../queries/user.queries';

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
  const { t } = useTranslation(['user', 'whatsNew']);
  const { data: user } = useQuery(useGetMeQueryOptions());
  const { openHub } = useWhatsNewHub();
  const whatsNewRepository = useWhatsNewRepository();
  const isInviteAvailable = useInviteAvailability();
  // 소개할 기능이 모두 꺼져 있으면 새로운 기능 항목을 숨긴다
  const campaign = filterAvailableCampaign(getBundledWhatsNewCampaign(WHATS_NEW_CAMPAIGN_ID), {
    isInviteAvailable,
  });

  const openWhatsNew = () => {
    if (!campaign || !user) {
      return;
    }
    whatsNewRepository.claimSeen(
      { userId: user.id, campaignId: campaign.id },
      toInstant(new Date().toISOString()),
    );
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
            testID="whats-new-open"
            icon={<MyPageMenuIcon Icon={InfoIcon} />}
            label={t('whatsNew:entry.mypage')}
            onPress={openWhatsNew}
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
        pathname="/settings/subscription"
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
