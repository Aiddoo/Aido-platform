import { StyledSafeAreaView } from '@src/shared/ui';
import type { PropsWithChildren } from 'react';
import { ScrollView } from 'react-native';

import { useMyPagePaneLayout } from '../hooks/use-my-page-pane-layout';

export function MyPagePaneLayout({ children }: PropsWithChildren) {
  const { scrollRef, handleScrollEnd, handleContentSizeChange, handleScrollBeginDrag } =
    useMyPagePaneLayout();

  return (
    <StyledSafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 16 }}
        contentInsetAdjustmentBehavior="automatic"
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
