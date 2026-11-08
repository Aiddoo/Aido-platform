import { MyPageMenuPane } from '@src/bootstrap/navigation/my-page-menu-pane';
import { NotificationBell } from '@src/features/notification/components/notification-bell';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { useTranslation } from '@src/shared/i18n';
import { AdaptivePane, MemoIllustration, Result, StyledSafeAreaView } from '@src/shared/ui';

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
              icon={<MemoIllustration />}
              title={t('mypage.empty.title')}
              description={t('mypage.empty.description')}
            />
          </StyledSafeAreaView>
        }
      />
    </>
  );
}
