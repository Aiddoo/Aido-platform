import { useWindowSizeClass, type WindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Box } from '../box/box';
import { HStack } from '../h-stack/h-stack';
import type { AdaptivePaneProps } from './adaptive-pane.types';

/** Expo `ArrangementView` split 예시와 같은 목록 폭 범위(260~400). */
const PRIMARY_PANE_WIDTH: Record<Exclude<WindowSizeClass, 'compact'>, number> = {
  medium: 320,
  expanded: 400,
};

/**
 * iPhone Duo는 펼치면 탭 바와 툴바를 좌우 세로 레일로 옮긴다.
 * 가로 safe-area inset은 이 컨테이너에서 한 번만 적용하고 자식 pane은 다시 더하지 않는다.
 */
export function AdaptivePane({ primary, secondary }: AdaptivePaneProps) {
  const windowSizeClass = useWindowSizeClass();
  const { left: leftInset, right: rightInset } = useSafeAreaInsets();

  if (windowSizeClass === 'compact') {
    return <>{primary}</>;
  }

  return (
    <HStack flex={1} style={{ paddingLeft: leftInset, paddingRight: rightInset }}>
      <Box testID="adaptive-pane-primary" style={{ width: PRIMARY_PANE_WIDTH[windowSizeClass] }}>
        {primary}
      </Box>
      <Box className="w-px bg-gray-2" />
      <Box testID="adaptive-pane-secondary" flex={1}>
        {secondary}
      </Box>
    </HStack>
  );
}
