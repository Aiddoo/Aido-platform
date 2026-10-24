import type { EdgeInsets } from 'react-native-safe-area-context';

export type PaneSlot = 'primary' | 'secondary';

export function getPaneInitialInsets(
  windowInsets: EdgeInsets,
  pane: PaneSlot,
  isRTL: boolean,
): EdgeInsets {
  const touchesLeftEdge = (pane === 'primary') !== isRTL;

  return touchesLeftEdge ? { ...windowInsets, right: 0 } : { ...windowInsets, left: 0 };
}
