import { Box, SafeAreaScrollView } from '@src/shared/ui';
import type { ReactNode } from 'react';

import { useMyPagePaneLayout } from '../hooks/use-my-page-pane-layout';

export function MyPagePaneLayout({ children }: { children: ReactNode }) {
  const { scrollRef, handleScrollEnd, handleSizeChange, handleScrollBeginDrag } =
    useMyPagePaneLayout();
  // 불투명 네이티브 헤더 아래에서 시작하므로 위 inset을 다시 주지 않는다(메모 탭과 같은 시작 위치)
  return (
    <Box flex={1} className="bg-white">
      <SafeAreaScrollView
        ref={scrollRef}
        className="flex-1"
        // 상세 칸 입력에 키보드가 떠 있어도 메뉴 첫 탭이 키보드만 내리지 않고 바로 눌린다
        keyboardShouldPersistTaps="handled"
        onScrollEndDrag={handleScrollEnd}
        onMomentumScrollEnd={handleScrollEnd}
        onContentSizeChange={handleSizeChange}
        onLayout={handleSizeChange}
        onScrollBeginDrag={handleScrollBeginDrag}
      >
        <Box className="px-4 pb-4">{children}</Box>
      </SafeAreaScrollView>
    </Box>
  );
}
