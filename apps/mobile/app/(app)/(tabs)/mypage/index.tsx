import { WhatsNewMenuItem } from '@src/features/app-config/whats-new/components/whats-new-menu-item';
import { MyPagePane } from '@src/features/identity/user/components/mypage-pane/mypage-pane';
import { MyPagePaneLayout } from '@src/features/identity/user/components/mypage-pane/mypage-pane-layout';
import { NotificationBell } from '@src/features/notification/components/notification-bell';
import { MyPageInviteCard } from '@src/features/social/invite/components/invite-reward-card';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { AdaptivePane } from '@src/shared/ui';

export default function MyPageScreen() {
  const isCompact = useWindowSizeClass() === 'compact';

  return (
    <>
      {isCompact && <NotificationBell.Toolbar />}
      <AdaptivePane
        primary={
          <MyPagePaneLayout isSplit={!isCompact}>
            <MyPagePane inviteCard={<MyPageInviteCard />} whatsNewItem={<WhatsNewMenuItem />} />
          </MyPagePaneLayout>
        }
        secondary={<MyPagePane.Empty />}
      />
    </>
  );
}
