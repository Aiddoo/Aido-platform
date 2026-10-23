import type { WindowSizeClass } from '@src/shared/utils/window-size-class';

/** Expo `ArrangementView` split 예시와 같은 목록 폭 범위(260~400). */
const PRIMARY_PANE_WIDTH: Record<Exclude<WindowSizeClass, 'compact'>, number> = {
  medium: 320,
  expanded: 400,
};

export function getPrimaryPaneWidth(windowSizeClass: Exclude<WindowSizeClass, 'compact'>): number {
  return PRIMARY_PANE_WIDTH[windowSizeClass];
}
