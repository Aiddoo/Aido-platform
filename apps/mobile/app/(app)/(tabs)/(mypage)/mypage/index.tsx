import { MyPageMenuPane } from '@src/bootstrap/navigation/my-page-menu-pane';
import { NotificationBellToolbar } from '@src/features/notification/components/notification-bell-toolbar';
import { useTranslation } from '@src/shared/i18n';
import { MemoIllustration, Result, StyledSafeAreaView, usePaneSizeClass } from '@src/shared/ui';
import { match, P } from 'ts-pattern';

/** 넓은 화면은 Stack이 왼쪽 칸에 메뉴를 그려 상세 칸에 빈 안내를 둔다 */
export default function MyPageScreen() {
  const { t } = useTranslation('user');
  const paneSizeClass = usePaneSizeClass();

  return (
    <>
      <NotificationBellToolbar />
      {match(paneSizeClass)
        .with('compact', () => <MyPageMenuPane />)
        .with(P.union('medium', 'expanded'), () => (
          <StyledSafeAreaView edges={['left', 'right']} className="flex-1 bg-white px-8">
            <Result
              icon={<MemoIllustration />}
              title={t('mypage.empty.title')}
              description={t('mypage.empty.description')}
            />
          </StyledSafeAreaView>
        ))
        .exhaustive()}
    </>
  );
}
