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
  KoreanIcon,
  ListIcon,
  MemoIcon,
  MicIcon,
  MoonIcon,
  PawIcon,
  PersonIcon,
  SettingsListGroup,
  type StyledIcon,
} from '@src/shared/ui';
import type { ComponentProps, ReactNode } from 'react';

import {
  type MyPageMenuPathname,
  useMyPageMenuNavigation,
} from '../../hooks/use-my-page-menu-navigation';

const MENU_ICON_SIZE = 20;

type MyPageMenuItemProps = Omit<
  ComponentProps<typeof SettingsListGroup.Item>,
  'onPress' | 'className' | 'icon' | 'isSelected'
> & {
  pathname: MyPageMenuPathname;
  Icon: StyledIcon;
};

function MyPageMenuItem({ pathname, Icon, ...props }: MyPageMenuItemProps) {
  const { navigate, isSelected } = useMyPageMenuNavigation();

  return (
    <SettingsListGroup.Item
      {...props}
      icon={<MyPageMenuIcon Icon={Icon} />}
      isSelected={isSelected(pathname)}
      onPress={() => navigate(pathname)}
    />
  );
}

function MyPageMenuIcon({ Icon }: { Icon: StyledIcon }) {
  const fontScaledSize = useFontScaledSize();

  return (
    <Icon
      width={fontScaledSize(MENU_ICON_SIZE)}
      height={fontScaledSize(MENU_ICON_SIZE)}
      colorClassName="text-main"
    />
  );
}

function Activity({ whatsNewItem }: { whatsNewItem: ReactNode }) {
  const { t } = useTranslation('user');

  return (
    <SettingsListGroup label={t('mypage.sections.activity')}>
      <MyPageMenuItem Icon={PersonIcon} label={t('mypage.items.friends')} pathname="/friends" />
      <SettingsListGroup.Separator />
      <MyPageMenuItem
        Icon={BlockIcon}
        label={t('mypage.items.blockedUsers')}
        pathname="/settings/blocked-users"
      />
      <SettingsListGroup.Separator />
      <MyPageMenuItem
        Icon={ListIcon}
        label={t('mypage.items.categories')}
        pathname="/settings/category-settings"
      />
      <SettingsListGroup.Separator />
      {whatsNewItem}
      <SettingsListGroup.Separator />
      <MyPageMenuItem
        Icon={FlagIcon}
        label={t('mypage.items.achievements')}
        pathname="/achievements"
      />
    </SettingsListGroup>
  );
}

function Subscription() {
  const { t } = useTranslation('user');

  return (
    <SettingsListGroup label={t('mypage.sections.subscription')}>
      <MyPageMenuItem Icon={AiIcon} label={t('mypage.items.aiReports')} pathname="/reports" />
      <SettingsListGroup.Separator />
      <MyPageMenuItem
        Icon={PawIcon}
        label={t('mypage.items.appIcon')}
        pathname="/settings/app-icon"
      />
      <SettingsListGroup.Separator />
      <MyPageMenuItem
        Icon={CrownIcon}
        label={t('mypage.items.subscription')}
        pathname="/settings/subscription"
      />
    </SettingsListGroup>
  );
}

function Settings() {
  const { t } = useTranslation(['user', 'settings']);

  return (
    <SettingsListGroup label={t('mypage.sections.settings')}>
      <MyPageMenuItem
        Icon={BellIcon}
        label={t('mypage.items.notifications')}
        pathname="/settings/notifications"
      />
      <SettingsListGroup.Separator />
      <MyPageMenuItem Icon={MoonIcon} label={t('mypage.items.theme')} pathname="/settings/theme" />
      <SettingsListGroup.Separator />
      <MyPageMenuItem
        Icon={EditIcon}
        label={t('mypage.items.fontSize')}
        pathname="/settings/font-size"
      />
      <SettingsListGroup.Separator />
      <MyPageMenuItem
        Icon={KoreanIcon}
        label={t('settings:titles.language')}
        pathname="/settings/language"
      />
      <SettingsListGroup.Separator />
      <MyPageMenuItem
        Icon={MicIcon}
        label={t('settings:titles.voiceStorage')}
        pathname="/settings/voice-storage"
      />
    </SettingsListGroup>
  );
}

function Support() {
  const { t } = useTranslation('user');

  return (
    <SettingsListGroup>
      <MyPageMenuItem
        Icon={ChatBubbleIcon}
        label={t('mypage.items.inquiry')}
        pathname="/settings/inquiry"
      />
      <SettingsListGroup.Separator />
      <MyPageMenuItem Icon={MemoIcon} label={t('mypage.items.terms')} pathname="/settings/terms" />
    </SettingsListGroup>
  );
}

export const MyPageMenu = { Activity, Subscription, Settings, Support };
