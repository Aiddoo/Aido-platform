import { AppVersionCheck } from '@src/features/app-config/app-version/components/app-version-check';
import { WhatsNewMenuItem } from '@src/features/app-config/whats-new/components/whats-new-menu-item';
import { AccessTierChip } from '@src/features/billing/subscription/components/access-tier-chip';
import { QuotaSummary } from '@src/features/billing/subscription/components/quota-summary';
import { AccountActionButtons } from '@src/features/identity/auth/components/account-action-buttons';
import { MyPageMenuItem } from '@src/features/identity/user/components/my-page-menu';
import { MyPagePaneLayout } from '@src/features/identity/user/components/my-page-pane-layout';
import { ProfileRow } from '@src/features/identity/user/components/profile-row';
import { NotificationBell } from '@src/features/notification/components/notification-bell';
import { InviteRewardButton } from '@src/features/social/invite/components/invite-reward-button';
import { useIsInviteAvailable } from '@src/features/social/invite/hooks/use-is-invite-available';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { useTranslation } from '@src/shared/i18n';
import {
  AdaptivePane,
  AiIcon,
  BellIcon,
  BlockIcon,
  ChatBubbleIcon,
  CrownIcon,
  DocsIcon,
  EditIcon,
  FlagIcon,
  H3,
  KoreanIcon,
  ListIcon,
  MemoIcon,
  MicIcon,
  MoonIcon,
  PawIcon,
  PersonIcon,
  QueryErrorBoundary,
  Result,
  SettingsListGroup,
  Spacing,
  StyledSafeAreaView,
  VStack,
} from '@src/shared/ui';
import { Suspense } from 'react';

export default function MyPageScreen() {
  const { t } = useTranslation('user');
  const isCompact = useWindowSizeClass() === 'compact';

  return (
    <>
      {isCompact && <NotificationBell.Toolbar />}
      <AdaptivePane
        primary={<MyPageMenuPane isSplit={!isCompact} />}
        secondary={
          <StyledSafeAreaView edges={['left', 'right']} className="flex-1 bg-white px-8">
            <Result
              icon={<DocsIcon width={72} height={72} />}
              title={t('mypage.empty.title')}
              description={t('mypage.empty.description')}
            />
          </StyledSafeAreaView>
        }
      />
    </>
  );
}

/** 넓은 화면의 메뉴 화면(`(mypage-menu)/_layout`)도 이 칸을 그려 들어가고 나올 때 왼쪽이 그대로다 */
export function MyPageMenuPane({ isSplit }: { isSplit: boolean }) {
  const { t } = useTranslation(['user', 'settings']);
  const isInviteAvailable = useIsInviteAvailable();

  return (
    <MyPagePaneLayout
      isSplit={isSplit}
      headerAction={
        <QueryErrorBoundary fallback={NotificationBell.Error}>
          <Suspense fallback={<NotificationBell.Loading />}>
            <NotificationBell />
          </Suspense>
        </QueryErrorBoundary>
      }
    >
      <H3>{t('mypage.header')}</H3>

      <Spacing size={20} />

      <VStack gap={12}>
        <QueryErrorBoundary fallback={SettingsListGroup.Error}>
          <Suspense fallback={<ProfileRow.Loading />}>
            <ProfileRow tierChip={<AccessTierChip />} />
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
          <WhatsNewMenuItem />
          <SettingsListGroup.Separator />
          <MyPageMenuItem
            Icon={FlagIcon}
            label={t('mypage.items.achievements')}
            pathname="/achievements"
          />
        </SettingsListGroup>

        <QuotaSummary />

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

        <SettingsListGroup label={t('mypage.sections.settings')}>
          <MyPageMenuItem
            Icon={BellIcon}
            label={t('mypage.items.notifications')}
            pathname="/settings/notifications"
          />
          <SettingsListGroup.Separator />
          <MyPageMenuItem
            Icon={MoonIcon}
            label={t('mypage.items.theme')}
            pathname="/settings/theme"
          />
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

        <SettingsListGroup>
          <MyPageMenuItem
            Icon={ChatBubbleIcon}
            label={t('mypage.items.inquiry')}
            pathname="/settings/inquiry"
          />
          <SettingsListGroup.Separator />
          <MyPageMenuItem
            Icon={MemoIcon}
            label={t('mypage.items.terms')}
            pathname="/settings/terms"
          />
        </SettingsListGroup>

        <AppVersionCheck />
      </VStack>

      <Spacing size={32} />

      <QueryErrorBoundary fallback={SettingsListGroup.Error}>
        <Suspense fallback={<AccountActionButtons.Loading />}>
          <AccountActionButtons />
        </Suspense>
      </QueryErrorBoundary>

      <Spacing size={40} />
    </MyPagePaneLayout>
  );
}
