import { HStack, StyledSafeAreaView } from '@src/shared/ui';
import type { PropsWithChildren, ReactNode } from 'react';
import { ScrollView } from 'react-native';

import { useMyPagePaneLayout } from '../hooks/use-my-page-pane-layout';

interface MyPagePaneLayoutProps extends PropsWithChildren {
  /** 두 칸의 왼쪽에 놓일 때. 네이티브 헤더가 없어 머리 동작과 위 여백을 여기서 그린다. */
  isSplit: boolean;
  headerAction: ReactNode;
}

export function MyPagePaneLayout({ isSplit, headerAction, children }: MyPagePaneLayoutProps) {
  const { scrollRef, handleScroll, handleContentSizeChange, handleScrollBeginDrag, topInset } =
    useMyPagePaneLayout();

  return (
    <StyledSafeAreaView
      className="flex-1 bg-white"
      edges={['bottom']}
      style={isSplit ? { paddingTop: topInset } : undefined}
    >
      {isSplit && (
        <StyledSafeAreaView edges={['left', 'right']}>
          <HStack px={16} py={10} justify="end">
            <HStack className="size-11" align="center" justify="center">
              {headerAction}
            </HStack>
          </HStack>
        </StyledSafeAreaView>
      )}
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 16 }}
        contentInsetAdjustmentBehavior="automatic"
        scrollEventThrottle={16}
        onScroll={handleScroll}
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
