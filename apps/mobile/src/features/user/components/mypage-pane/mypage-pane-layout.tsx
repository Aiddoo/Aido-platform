import { NotificationBell } from '@src/features/notification/components/notification-bell';
import { HStack, StyledSafeAreaView } from '@src/shared/ui';
import type { PropsWithChildren } from 'react';
import { ScrollView } from 'react-native';

import { useMyPagePaneLayout } from '../../hooks/use-mypage-pane-layout';

interface MyPagePaneLayoutProps extends PropsWithChildren {
  /** 두 칸의 왼쪽에 놓일 때. 네이티브 헤더가 없어 종과 위 여백을 여기서 그린다. */
  isSplit: boolean;
}

export function MyPagePaneLayout({ isSplit, children }: MyPagePaneLayoutProps) {
  const { scrollRef, handleScroll, topInset } = useMyPagePaneLayout();

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
              <NotificationBell.Header />
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
      >
        <StyledSafeAreaView edges={['left', 'right']} className="px-4">
          {children}
        </StyledSafeAreaView>
      </ScrollView>
    </StyledSafeAreaView>
  );
}
