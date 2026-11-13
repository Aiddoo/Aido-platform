import { MyPageMenuPane } from '@src/bootstrap/navigation/my-page-menu-pane';
import { MyPageStack } from '@src/bootstrap/navigation/my-page-stack';
import { useTranslation } from '@src/shared/i18n';
import { IS_IPAD } from '@src/shared/infra/device/device-info';
import { PaneArea, StackHeaderTitle, usePaneSizeClass } from '@src/shared/ui';
import { Stack } from 'expo-router';

// 푸시·링크로 하위 화면을 바로 열어도 뒤로 가면 내 정보 메뉴가 나온다
export const unstable_settings = {
  anchor: 'mypage/index',
};

export default function MyPageTabLayout() {
  return (
    <PaneArea>
      <MyPageTabStack />
    </PaneArea>
  );
}

/** 메뉴 칸과 첫 화면 제목은 탭 사이드바를 뺀 폭으로 정하므로 `PaneArea` 안에서 그린다 */
function MyPageTabStack() {
  const isCompact = usePaneSizeClass() === 'compact';
  const { t } = useTranslation('user');

  return (
    <MyPageStack menu={<MyPageMenuPane />}>
      {/* iPadOS는 위 탭 바가 헤더에 있으면 탭 첫 화면의 제목 글자를 숨겨 헤더가 낮아지고, 메뉴를 고르면 메뉴 칸이 내려간다. 제목 뷰는 하위 화면 제목처럼 탭 바 아래 줄에 그린다 */}
      <Stack.Screen
        name="mypage/index"
        options={{
          title: isCompact ? '' : t('mypage.header'),
          ...(!isCompact && IS_IPAD && { headerTitle: StackHeaderTitle }),
        }}
      />
    </MyPageStack>
  );
}
