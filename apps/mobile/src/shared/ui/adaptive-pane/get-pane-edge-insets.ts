import type { EdgeInsets } from 'react-native-safe-area-context';

export type PaneSlot = 'primary' | 'secondary';

export function getPaneEdgeInsets(
  windowInsets: EdgeInsets,
  pane: PaneSlot,
  { isRTL }: { isRTL: boolean },
): EdgeInsets {
  const touchesLeftEdge = (pane === 'primary') !== isRTL;

  return touchesLeftEdge ? { ...windowInsets, right: 0 } : { ...windowInsets, left: 0 };
}
