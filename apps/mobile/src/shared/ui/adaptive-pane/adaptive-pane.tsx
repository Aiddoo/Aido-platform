import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Box } from '../box/box';
import { HStack } from '../h-stack/h-stack';
import type { AdaptivePaneProps } from './adaptive-pane.types';
import { getPrimaryPaneWidth } from './get-primary-pane-width';

/**
 * iPhone Duo는 펼치면 탭 바와 툴바를 좌우 세로 레일로 옮긴다.
 * 가로 safe-area inset은 이 컨테이너에서 한 번만 적용하고 자식 pane은 다시 더하지 않는다.
 *
 * 접기/펼치기에서 pane이 다시 마운트되면 스크롤 위치·입력·내비게이터 상태를 잃는다.
 * 두 pane을 size class와 무관하게 같은 트리 위치(같은 슬롯)에 두고 보이는 슬롯만 바꾼다.
 */
export function AdaptivePane({ primary, secondary, compactPane = 'primary' }: AdaptivePaneProps) {
  const windowSizeClass = useWindowSizeClass();
  const { left: leftInset, right: rightInset } = useSafeAreaInsets();
  const isCompact = windowSizeClass === 'compact';
  const showsPrimary = !isCompact || compactPane === 'primary';
  const showsSecondary = !isCompact || compactPane === 'secondary';

  return (
    <HStack flex={1} pl={isCompact ? undefined : leftInset} pr={isCompact ? undefined : rightInset}>
      {showsPrimary && (
        <Box
          testID="adaptive-pane-primary"
          style={isCompact ? { flex: 1 } : { width: getPrimaryPaneWidth(windowSizeClass) }}
        >
          {primary}
        </Box>
      )}
      {!isCompact && <Box className="w-px bg-gray-2" />}
      {showsSecondary && (
        <Box testID="adaptive-pane-secondary" flex={1}>
          {secondary}
        </Box>
      )}
    </HStack>
  );
}
