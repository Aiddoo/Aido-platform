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
  SettingsCard,
  type StyledIconType,
} from '@src/shared/ui';
import type { ComponentProps, ReactNode } from 'react';

import {
  type MyPageMenuPathname,
  useMyPageMenuNavigation,
} from '../../hooks/use-mypage-menu-navigation';

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

function Activity({ whatsNewItem }: { whatsNewItem: ReactNode }) {
  const { t } = useTranslation('user');

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
      <SettingsCard.Separator />
      {whatsNewItem}
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
