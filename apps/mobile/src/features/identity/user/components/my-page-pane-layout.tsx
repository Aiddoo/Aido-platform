import { StyledSafeAreaView } from '@src/shared/ui';
import type { PropsWithChildren } from 'react';
import { ScrollView } from 'react-native';

import { useMyPagePaneLayout } from '../hooks/use-my-page-pane-layout';

export function MyPagePaneLayout({ children }: PropsWithChildren) {
  const { scrollRef, handleScrollEnd, handleContentSizeChange, handleScrollBeginDrag } =
    useMyPagePaneLayout();

  // 넓은 화면 왼쪽 칸은 위에 Stack 헤더가 없어 상태 표시줄을 직접 피한다. 헤더 아래(좁은 화면)는 겹치지 않아 0이다.
  // iOS 스크롤 자동 inset과 겹치지 않게 위쪽은 safe area 한 곳에서만 준다
  return (
    <StyledSafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 16 }}
        contentInsetAdjustmentBehavior="never"
        onScrollEndDrag={handleScrollEnd}
        onMomentumScrollEnd={handleScrollEnd}
        onContentSizeChange={handleContentSizeChange}
        onScrollBeginDrag={handleScrollBeginDrag}
      >
        <StyledSafeAreaView edges={['left', 'right']} className="px-4">
          {children}
        </StyledSafeAreaView>
      </ScrollView>
    </StyledSafeAreaView>
  );
}
