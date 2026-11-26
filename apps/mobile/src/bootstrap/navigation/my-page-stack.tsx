import {
  Box,
  getPaneEdgeInsets,
  HStack,
  usePaneColumns,
  usePaneSizeClass,
  useStackScreenOptions,
} from '@src/shared/ui';
import { findVerticalFold } from '@src/shared/utils/find-vertical-fold';
import { type NativeStackNavigationOptions, Stack, useRootNavigationState } from 'expo-router';
import type { ReactNode } from 'react';
import { I18nManager } from 'react-native';
import { ReservedRegionsProvider, useReservedRegions } from 'react-native-reserved-regions';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';

/** iPadOS 세로에서 떠 있는 탭 바가 오른쪽 칸 헤더의 뒤로 가기를 가려 헤더는 전체 폭, 메뉴는 본문 왼쪽 칸에 그린다 */
export function MyPageStack({ menu, children }: { menu: ReactNode; children?: ReactNode }) {
  const isCompact = usePaneSizeClass() === 'compact';
  const screenOptions = useStackScreenOptions({ hasContentBackground: true });
  const getDetailOptions = useMyPageDetailOptions();

  // 화면 안 칸들은 바깥 `PaneArea`가 잰 탭 안 영역 inset을 받는다
  return (
    <Stack
      // 제목은 화면이 스스로 정한다(`Stack.Screen options`). 정하지 않은 화면은 route 이름 대신 빈 제목이다
      screenOptions={({ route }) => ({
        ...screenOptions,
        title: '',
        ...(!isCompact && getDetailOptions(route)),
      })}
      screenLayout={({ children: screen }) => (
        <MyPageScreenLayout menu={menu}>{screen}</MyPageScreenLayout>
      )}
    >
      {children}
    </Stack>
  );
}

const DETAIL_ROOT_OPTIONS = {
  headerBackVisible: false,
  gestureEnabled: false,
  animation: 'none',
} as const satisfies NativeStackNavigationOptions;

// 메뉴 칸이 화면마다 같은 자리에 있어 밀어 넣지 않고 겹쳐 바꿔야 상세만 바뀌어 보인다
const STACKED_DETAIL_OPTIONS = {
  animation: 'fade',
  animationMatchesGesture: true,
} as const satisfies NativeStackNavigationOptions;

interface StackStateNode {
  routes: readonly { key?: string; state?: StackStateNode }[];
}

type MyPageDetailOptionsGetter = (route: { key?: string }) => NativeStackNavigationOptions;

// 첫 상세(메뉴가 고른 화면)는 뒤로 가기 없이, 더 들어간 화면은 네이티브 뒤로 가기로. 렌더 중 getState 대신 구독한 루트 상태에서 자리를 찾는다
function useMyPageDetailOptions(): MyPageDetailOptionsGetter {
  const rootState = useRootNavigationState();

  return (route) => {
    // Stack은 이 렌더의 루트 상태로 화면을 그려 그 route는 늘 그 안에 있다. 걷고 바로 연 메뉴도 같은 렌더에서 자리 1이다
    const stackIndex = findStackRouteKeys(rootState, route.key)?.indexOf(route.key ?? '') ?? -1;
    if (stackIndex <= 0) {
      return {};
    }
    return stackIndex === 1 ? DETAIL_ROOT_OPTIONS : STACKED_DETAIL_OPTIONS;
  };
}

function findStackRouteKeys(
  state: StackStateNode,
  routeKey: string | undefined,
): readonly string[] | null {
  if (state.routes.some(({ key }) => key === routeKey)) {
    return state.routes.map(({ key }) => key ?? '');
  }
  for (const route of state.routes) {
    const found = route.state == null ? null : findStackRouteKeys(route.state, routeKey);
    if (found != null) {
      return found;
    }
  }
  return null;
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
