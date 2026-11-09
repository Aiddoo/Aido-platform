import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { Box, SafeAreaScrollView } from '@src/shared/ui';
import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMyPagePaneLayout } from '../hooks/use-my-page-pane-layout';

export function MyPagePaneLayout({ children }: { children: ReactNode }) {
  const { scrollRef, handleScrollEnd, handleSizeChange, handleScrollBeginDrag } =
    useMyPagePaneLayout();
  const isCompact = useWindowSizeClass() === 'compact';
  const { top } = useSafeAreaInsets();

  // 넓은 화면 칸은 전체 폭 헤더 바로 아래에서 시작한다. 좁은 화면 첫 화면은 헤더 아래로 위 inset만큼 띄운 지금 모양을 지킨다
  return (
    <Box flex={1} className="bg-white" style={{ paddingTop: isCompact ? top : 0 }}>
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
