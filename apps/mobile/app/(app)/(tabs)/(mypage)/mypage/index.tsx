import { MyPageMenuPane } from '@src/bootstrap/navigation/my-page-menu-pane';
import { NotificationBellToolbar } from '@src/features/notification/components/notification-bell-toolbar';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { useTranslation } from '@src/shared/i18n';
import { MemoIllustration, Result, StyledSafeAreaView } from '@src/shared/ui';

/** 좁은 화면은 메뉴를, 넓은 화면은 왼쪽 칸에 메뉴가 있어 오른쪽 칸의 빈 안내를 그린다 */
export default function MyPageScreen() {
  const { t } = useTranslation('user');
  const isCompact = useWindowSizeClass() === 'compact';

  return (
    <>
      <NotificationBellToolbar />
      {isCompact ? (
        <MyPageMenuPane placement="screen" />
      ) : (
        <StyledSafeAreaView edges={['left', 'right']} className="flex-1 bg-white px-8">
          <Result
            icon={<MemoIllustration />}
            title={t('mypage.empty.title')}
            description={t('mypage.empty.description')}
          />
        </StyledSafeAreaView>
      )}
    </>
  );
}
