import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Box } from '../box/box';
import { HStack } from '../h-stack/h-stack';
import type { AdaptivePaneProps } from './adaptive-pane.types';
import { getPrimaryPaneWidth } from './get-primary-pane-width';

/**
 * pane마다 SafeAreaProvider를 두어 그 안의 SafeAreaView와 useSafeAreaInsets가 창이 아닌
 * pane이 실제로 겹치는 safe area(iPhone Duo 세로 레일 등)만 보게 한다.
 *
 * 접기/펼치기에서 pane이 다시 마운트되면 스크롤 위치·입력·내비게이터 상태를 잃으므로
 * 두 pane을 size class와 무관하게 같은 트리 슬롯에 두고 보이는 슬롯만 바꾼다.
 */
export function AdaptivePane({ primary, secondary, compactPane = 'primary' }: AdaptivePaneProps) {
  const windowSizeClass = useWindowSizeClass();
  const isCompact = windowSizeClass === 'compact';
  const showsPrimary = !isCompact || compactPane === 'primary';
  const showsSecondary = !isCompact || compactPane === 'secondary';

  return (
    <HStack flex={1}>
      {showsPrimary && (
        <Box
          testID="adaptive-pane-primary"
          style={isCompact ? { flex: 1 } : { width: getPrimaryPaneWidth(windowSizeClass) }}
        >
          <SafeAreaProvider>{primary}</SafeAreaProvider>
        </Box>
      )}
      {!isCompact && <Box className="w-px bg-gray-2" />}
      {showsSecondary && (
        <Box testID="adaptive-pane-secondary" flex={1}>
          <SafeAreaProvider>{secondary}</SafeAreaProvider>
        </Box>
      )}
    </HStack>
  );
}
