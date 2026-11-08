import { MyPageMenuPane } from '@src/bootstrap/navigation/my-page-menu-pane';
import { NotificationBellToolbar } from '@src/features/notification/components/notification-bell-toolbar';
import { useTranslation } from '@src/shared/i18n';
import { AdaptivePane, MemoIllustration, Result, StyledSafeAreaView } from '@src/shared/ui';

export default function MyPageScreen() {
  const { t } = useTranslation('user');

  return (
    <>
      <NotificationBellToolbar />
      <AdaptivePane
        primary={<MyPageMenuPane />}
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
