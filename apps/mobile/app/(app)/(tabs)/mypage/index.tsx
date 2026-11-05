import { NotificationBell } from '@src/features/notification/components/notification-bell';
import { MyPagePane } from '@src/features/user/components/mypage-pane/mypage-pane';
import { MyPagePaneLayout } from '@src/features/user/components/mypage-pane/mypage-pane-layout';
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
            <MyPagePane />
          </MyPagePaneLayout>
        }
        secondary={<MyPagePane.Empty />}
      />
    </>
  );
}
