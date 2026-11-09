import { StyledSafeAreaView } from '@src/shared/ui';
import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';

import { useMyPagePaneLayout } from '../hooks/use-my-page-pane-layout';

export function MyPagePaneLayout({ children }: { children: ReactNode }) {
  const { scrollRef, handleScrollEnd, handleSizeChange, handleScrollBeginDrag } =
    useMyPagePaneLayout();

  // 위쪽은 ScrollView 바깥 safe area가 맡아 스크롤한 메뉴가 상태 표시줄 밑으로 지나가지 않는다. iOS 스크롤 자동 inset은 꺼 같은 여백을 두 번 주지 않는다
  return (
    <StyledSafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 16 }}
        contentInsetAdjustmentBehavior="never"
        // 상세 칸 입력에 키보드가 떠 있어도 메뉴 첫 탭이 키보드만 내리지 않고 바로 눌린다
        keyboardShouldPersistTaps="handled"
        onScrollEndDrag={handleScrollEnd}
        onMomentumScrollEnd={handleScrollEnd}
        onContentSizeChange={handleSizeChange}
        onLayout={handleSizeChange}
        onScrollBeginDrag={handleScrollBeginDrag}
      >
        <StyledSafeAreaView edges={['left', 'right']} className="px-4">
          {children}
        </StyledSafeAreaView>
      </ScrollView>
    </StyledSafeAreaView>
  );
}
