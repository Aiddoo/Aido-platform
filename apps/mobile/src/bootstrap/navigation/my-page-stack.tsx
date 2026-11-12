import { getMyPageDetailOptions } from '@src/features/identity/user/utils/my-page-detail-options';
import {
  Box,
  getPaneEdgeInsets,
  HStack,
  usePaneColumns,
  usePaneSizeClass,
  useStackScreenOptions,
} from '@src/shared/ui';
import { findVerticalFold } from '@src/shared/utils/find-vertical-fold';
import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { I18nManager } from 'react-native';
import { ReservedRegionsProvider, useReservedRegions } from 'react-native-reserved-regions';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * 마이 탭 Stack. 넓은 화면도 네이티브 헤더를 전체 폭으로 둔다. iPadOS 세로에서 떠 있는 탭 바가 헤더 가운데에 놓여, 오른쪽 칸에서 시작하는 헤더는 뒤로 가기가 탭 바 밑에 가려진다.
 * 그래서 메뉴는 헤더 위가 아니라 화면마다 본문 왼쪽 칸에 그린다
 */
export function MyPageStack({ menu, children }: { menu: ReactNode; children?: ReactNode }) {
  const isCompact = usePaneSizeClass() === 'compact';
  const screenOptions = useStackScreenOptions({ hasContentBackground: true });

  // 화면 안 칸들은 바깥 `PaneArea`가 잰 탭 안 영역 inset을 받는다
  return (
    <Stack
      screenOptions={(input) => ({
        ...screenOptions,
        ...(!isCompact && getMyPageDetailOptions(input)),
      })}
      screenLayout={({ children: screen }) => (
        <MyPageScreenLayout menu={menu}>{screen}</MyPageScreenLayout>
      )}
    >
      {children}
    </Stack>
  );
}

interface MyPageScreenLayoutProps {
  menu: ReactNode;
  children: ReactNode;
}

function MyPageScreenLayout({ menu, children }: MyPageScreenLayoutProps) {
  return (
    <ReservedRegionsProvider style={{ flex: 1 }}>
      <MyPageScreenColumns menu={menu}>{children}</MyPageScreenColumns>
    </ReservedRegionsProvider>
  );
}

/** 접고 펼 때 화면이 다시 마운트되지 않게 상세는 늘 같은 트리 슬롯에 둔다. 칸마다 닿는 가장자리의 inset만 넘긴다 */
function MyPageScreenColumns({ menu, children }: MyPageScreenLayoutProps) {
  const { isSplit, primaryWidth } = usePaneColumns();
  const fold = findVerticalFold(useReservedRegions());
  const insets = useSafeAreaInsets();
  const { isRTL } = I18nManager;

  return (
    <HStack flex={1}>
      {isSplit && (
        <>
          <Box style={{ width: primaryWidth }}>
            <SafeAreaInsetsContext value={getPaneEdgeInsets(insets, 'primary', { isRTL })}>
              {menu}
            </SafeAreaInsetsContext>
          </Box>
          {fold == null ? (
            <Box className="w-px bg-gray-2" />
          ) : (
            <Box style={{ width: fold.frame.width }} />
          )}
        </>
      )}
      <Box flex={1}>
        <SafeAreaInsetsContext
          value={isSplit ? getPaneEdgeInsets(insets, 'secondary', { isRTL }) : insets}
        >
          {children}
        </SafeAreaInsetsContext>
      </Box>
    </HStack>
  );
}
