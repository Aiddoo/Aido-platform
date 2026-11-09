import { Box, StyledSafeAreaView } from '@src/shared/ui';
import { getDefaultHeaderHeight } from 'expo-router/react-navigation';
import type { ReactNode } from 'react';
import { ScrollView, useWindowDimensions } from 'react-native';

import { useMyPagePaneLayout } from '../hooks/use-my-page-pane-layout';

export type MyPageMenuPlacement = 'pane' | 'screen';

interface MyPagePaneLayoutProps {
  /** 넓은 화면 왼쪽 칸(`pane`)이면 위에 Stack 헤더가 없어 제목을 헤더 높이 띠에 둔다 */
  placement: MyPageMenuPlacement;
  title: ReactNode;
  children: ReactNode;
}

export function MyPagePaneLayout({ placement, title, children }: MyPagePaneLayoutProps) {
  const { scrollRef, handleScrollEnd, handleContentSizeChange, handleScrollBeginDrag } =
    useMyPagePaneLayout();
  const window = useWindowDimensions();

  // 위쪽은 ScrollView 바깥 safe area가 맡아 스크롤한 메뉴가 상태 표시줄 밑으로 지나가지 않는다(헤더 아래 좁은 화면은 0).
  // iOS 스크롤 자동 inset은 꺼 같은 여백을 두 번 주지 않는다
  return (
    <StyledSafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 16 }}
        contentInsetAdjustmentBehavior="never"
        // 오른쪽 칸 입력에 키보드가 떠 있어도 메뉴 첫 탭이 키보드만 내리지 않고 바로 눌린다
        keyboardShouldPersistTaps="handled"
        onScrollEndDrag={handleScrollEnd}
        onMomentumScrollEnd={handleScrollEnd}
        onContentSizeChange={handleContentSizeChange}
        onScrollBeginDrag={handleScrollBeginDrag}
      >
        <StyledSafeAreaView edges={['left', 'right']} className="px-4">
          {placement === 'pane' ? (
            // 상태 표시줄이 레일로 가 위 inset이 0이어도(펼친 Duo) 제목이 가장자리에 붙지 않고 헤더 제목 줄 높이에 놓인다
            <Box
              className="justify-center"
              style={{ minHeight: getDefaultHeaderHeight(window, false, 0) }}
            >
              {title}
            </Box>
          ) : (
            title
          )}
          {children}
        </StyledSafeAreaView>
      </ScrollView>
    </StyledSafeAreaView>
  );
}
