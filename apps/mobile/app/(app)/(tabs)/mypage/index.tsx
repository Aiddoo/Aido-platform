import { AppVersionCheck } from '@src/features/app-config/app-version/components/app-version-check';
import { WhatsNewMenuItem } from '@src/features/app-config/whats-new/components/whats-new-menu-item';
import { AccessTierChip } from '@src/features/billing/subscription/components/access-tier-chip';
import { QuotaSummary } from '@src/features/billing/subscription/components/quota-summary';
import { AccountActionButtons } from '@src/features/identity/user/components/account-action-buttons';
import { MyPageMenu } from '@src/features/identity/user/components/mypage-menu/mypage-menu';
import { MyPagePaneLayout } from '@src/features/identity/user/components/mypage-pane/mypage-pane-layout';
import { ProfileCard } from '@src/features/identity/user/components/profile-card';
import { NotificationBell } from '@src/features/notification/components/notification-bell';
import { MyPageInviteCard } from '@src/features/social/invite/components/invite-reward-card';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { useTranslation } from '@src/shared/i18n';
import {
  AdaptivePane,
  DocsIcon,
  H3,
  QueryErrorBoundary,
  Result,
  SettingsCard,
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
  const { t } = useTranslation('user');

  return (
    <MyPagePaneLayout isSplit={isSplit} headerAction={<NotificationBell.Header />}>
      <H3>{t('mypage.header')}</H3>

      <Spacing size={20} />

      <VStack gap={12}>
        <QueryErrorBoundary fallback={SettingsCard.Error}>
          <Suspense fallback={<ProfileCard.Loading />}>
            <ProfileCard tierChip={<AccessTierChip />} />
          </Suspense>
        </QueryErrorBoundary>

        <MyPageInviteCard />

        <MyPageMenu.Activity whatsNewItem={<WhatsNewMenuItem />} />

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

      <Spacing size={40} />
    </MyPagePaneLayout>
  );
}
