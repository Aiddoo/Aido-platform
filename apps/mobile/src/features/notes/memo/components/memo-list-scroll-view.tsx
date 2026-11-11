import { useRefresh } from '@src/shared/hooks/use-refresh';
import { Box, StyledSafeAreaView } from '@src/shared/ui';
import { useQueryClient } from '@tanstack/react-query';
import { type PropsWithChildren, useRef } from 'react';
import { RefreshControl } from 'react-native';
import Animated, { clamp, useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';

import { refreshMemos } from '../queries/memo-cache';
import { ScrollProgressWidget } from './scroll-progress-widget';

/** 당겨서 새로고침과 스크롤 진행 위젯이 달린 메모 탭 본문 */
export function MemoListScrollView({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [isRefreshing, handleRefresh] = useRefresh(() => refreshMemos(queryClient));
  const scrollRef = useRef<Animated.ScrollView>(null);
  const progress = useSharedValue(0);

  const handleScroll = useAnimatedScrollHandler({
    onScroll: ({ contentOffset: { y }, contentSize, layoutMeasurement }) => {
      const scrollable = contentSize.height - layoutMeasurement.height;
      progress.set(scrollable > 0 ? clamp(y / scrollable, 0, 1) : 0);
    },
  });

  return (
    <>
      <Animated.ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        <StyledSafeAreaView edges={['left', 'right']} className="grow">
          <Box className="grow gap-4 px-4">{children}</Box>
        </StyledSafeAreaView>
      </Animated.ScrollView>

      <ScrollProgressWidget
        progress={progress}
        onScrollToTop={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
        bottomOffset={16}
      />
    </>
  );
}
