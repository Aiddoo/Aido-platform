import { AppVersionCheck } from '@src/features/app-config/app-version/components/app-version-check';
import { WhatsNewMenuItem } from '@src/features/app-config/whats-new/components/whats-new-menu-item';
import { AccessTierChip } from '@src/features/billing/subscription/components/access-tier-chip';
import { PlanSummary } from '@src/features/billing/subscription/components/plan-summary';
import { PlanTypeValue } from '@src/features/billing/subscription/components/plan-type-value';
import { AppIconValue } from '@src/features/device/app-icon/components/app-icon-value';
import { AccountActionButtons } from '@src/features/identity/auth/components/account-action-buttons';
import { MyPageMenuItem } from '@src/features/identity/user/components/my-page-menu-item';
import { MyPagePaneLayout } from '@src/features/identity/user/components/my-page-pane-layout';
import { ProfileRow } from '@src/features/identity/user/components/profile-row';
import { MyPageMenuNavigationProvider } from '@src/features/identity/user/hooks/use-my-page-menu-navigation';
import { PushStatusValue } from '@src/features/notification/components/push-status-value';
import { FriendCountValue } from '@src/features/social/friend/components/friend-count-value';
import { InviteRewardButton } from '@src/features/social/invite/components/invite-reward-button';
import { useIsInviteAvailable } from '@src/features/social/invite/hooks/use-is-invite-available';
import { useTranslation } from '@src/shared/i18n';
import { APP_LOCALES } from '@src/shared/i18n/app-locales';
import type { FontScale } from '@src/shared/preferences/font-scale.preference';
import type { ThemeMode } from '@src/shared/preferences/theme-mode.preference';
import { useFontScale } from '@src/shared/providers/font-scale-provider';
import { useLanguage } from '@src/shared/providers/language-provider';
import { useAppTheme } from '@src/shared/providers/theme-provider';
import {
  BadgeDuoIcon,
  BellDuoIcon,
  BlockedDuoIcon,
  CategoryDuoIcon,
  CrownDuoIcon,
  AppIconDuoIcon,
  FontSizeDuoIcon,
  FriendsDuoIcon,
  H3,
  InquiryDuoIcon,
  LanguageDuoIcon,
  QueryErrorBoundary,
  ReportDuoIcon,
  SettingsListGroup,
  Spacing,
  TermsDuoIcon,
  ThemeDuoIcon,
  usePaneSizeClass,
  VoiceDuoIcon,
  VStack,
} from '@src/shared/ui';
import { Suspense } from 'react';

/** 좁은 화면은 마이 탭 첫 화면이, 넓은 화면은 마이 탭 화면마다 왼쪽 칸이 그린다 */
export function MyPageMenuPane() {
  const { t } = useTranslation(['user', 'settings']);
  const isInviteAvailable = useIsInviteAvailable();
  const isCompact = usePaneSizeClass() === 'compact';

  return (
    <MyPageMenuNavigationProvider>
      <MyPagePaneLayout>
        {/* 넓은 화면은 헤더를 전체 폭으로 두어 제목이 헤더에 있다 */}
        {isCompact && <H3>{t('mypage.header')}</H3>}
        <Spacing size={16} />

        <VStack gap={12}>
          <QueryErrorBoundary fallback={ProfileRow.Error}>
            <Suspense fallback={<ProfileRow.Loading />}>
              <ProfileRow tierChip={<AccessTierChip />} />
            </Suspense>
          </QueryErrorBoundary>

          <QueryErrorBoundary fallback={PlanSummary.Error}>
            <Suspense fallback={<PlanSummary.Loading />}>
              <PlanSummary />
            </Suspense>
          </QueryErrorBoundary>

          {/* 사용 가능 여부를 모르거나 묻지 못했으면 카드를 그리지 않아 꺼진 기능의 스켈레톤·오류가 번쩍이지 않는다 */}
          {isInviteAvailable && (
            <QueryErrorBoundary fallback={InviteRewardButton.Error}>
              <Suspense fallback={<InviteRewardButton.Loading />}>
                <InviteRewardButton />
              </Suspense>
            </QueryErrorBoundary>
          )}

          <SettingsListGroup label={t('mypage.sections.friends')}>
            <MyPageMenuItem
              Icon={FriendsDuoIcon}
              label={t('mypage.items.friends')}
              pathname="/friends"
              value={<FriendCountValue />}
            />
            <SettingsListGroup.Separator />
            <MyPageMenuItem
              Icon={BlockedDuoIcon}
              label={t('mypage.items.blockedUsers')}
              pathname="/settings/blocked-users"
            />
          </SettingsListGroup>

          <SettingsListGroup label={t('mypage.sections.records')}>
            <MyPageMenuItem
              Icon={BadgeDuoIcon}
              label={t('mypage.items.achievements')}
              pathname="/achievements"
            />
            <SettingsListGroup.Separator />
            <MyPageMenuItem
              Icon={ReportDuoIcon}
              label={t('mypage.items.aiReports')}
              pathname="/reports"
            />
          </SettingsListGroup>

          <SettingsListGroup label={t('mypage.sections.settings')}>
            <MyPageMenuItem
              Icon={BellDuoIcon}
              label={t('mypage.items.notifications')}
              pathname="/settings/notifications"
              value={<PushStatusValue />}
            />
            <SettingsListGroup.Separator />
            <MyPageMenuItem
              Icon={CategoryDuoIcon}
              label={t('mypage.items.categories')}
              pathname="/settings/category-settings"
            />
            <SettingsListGroup.Separator />
            <MyPageMenuItem
              Icon={ThemeDuoIcon}
              label={t('mypage.items.theme')}
              pathname="/settings/theme"
              value={<ThemeValue />}
            />
            <SettingsListGroup.Separator />
            <MyPageMenuItem
              Icon={FontSizeDuoIcon}
              label={t('mypage.items.fontSize')}
              pathname="/settings/font-size"
              value={<FontScaleValue />}
            />
            <SettingsListGroup.Separator />
            <MyPageMenuItem
              Icon={LanguageDuoIcon}
              label={t('settings:titles.language')}
              pathname="/settings/language"
              value={<LanguageValue />}
            />
            <SettingsListGroup.Separator />
            <MyPageMenuItem
              Icon={VoiceDuoIcon}
              label={t('settings:titles.voiceStorage')}
              pathname="/settings/voice-storage"
            />
          </SettingsListGroup>

          <SettingsListGroup label={t('mypage.sections.subscription')}>
            <MyPageMenuItem
              Icon={CrownDuoIcon}
              label={t('mypage.items.subscription')}
              pathname="/settings/subscription"
              value={<PlanTypeValue />}
            />
            <SettingsListGroup.Separator />
            <MyPageMenuItem
              Icon={AppIconDuoIcon}
              label={t('mypage.items.appIcon')}
              pathname="/settings/app-icon"
              value={<AppIconValue />}
            />
          </SettingsListGroup>

          <SettingsListGroup label={t('mypage.sections.support')}>
            <WhatsNewMenuItem />
            <SettingsListGroup.Separator />
            <MyPageMenuItem
              Icon={InquiryDuoIcon}
              label={t('mypage.items.inquiry')}
              pathname="/settings/inquiry"
            />
            <SettingsListGroup.Separator />
            <MyPageMenuItem
              Icon={TermsDuoIcon}
              label={t('mypage.items.terms')}
              pathname="/settings/terms"
            />
          </SettingsListGroup>

          <AppVersionCheck />
        </VStack>

        <Spacing size={32} />

        <QueryErrorBoundary fallback={AccountActionButtons.Error}>
          <Suspense fallback={<AccountActionButtons.Loading />}>
            <AccountActionButtons />
          </Suspense>
        </QueryErrorBoundary>

        <Spacing size={40} />
      </MyPagePaneLayout>
    </MyPageMenuNavigationProvider>
  );
}

const THEME_LABEL_KEYS = {
  system: 'theme.system',
  light: 'theme.light',
  dark: 'theme.dark',
} as const satisfies Record<ThemeMode, string>;

const FONT_SCALE_LABEL_KEYS = {
  xsmall: 'fontSize.xsmall',
  small: 'fontSize.small',
  medium: 'fontSize.medium',
  large: 'fontSize.large',
  xlarge: 'fontSize.xlarge',
} as const satisfies Record<FontScale, string>;

function ThemeValue() {
  const { t } = useTranslation('settings');
  const { mode } = useAppTheme();

  return <SettingsListGroup.Value>{t(THEME_LABEL_KEYS[mode])}</SettingsListGroup.Value>;
}

function FontScaleValue() {
  const { t } = useTranslation('settings');
  const { fontScale } = useFontScale();

  return <SettingsListGroup.Value>{t(FONT_SCALE_LABEL_KEYS[fontScale])}</SettingsListGroup.Value>;
}

function LanguageValue() {
  const { t } = useTranslation('settings');
  const { languageMode } = useLanguage();

  // 언어 이름은 언어 설정 화면처럼 그 언어로 고정해 적는다
  return (
    <SettingsListGroup.Value>
      {languageMode === 'system' ? t('language.system') : APP_LOCALES[languageMode].nativeName}
    </SettingsListGroup.Value>
  );
}
