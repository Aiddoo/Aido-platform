/** Material window size class 기준 폭(dp). iOS regular width와도 일치한다. */
const MEDIUM_WINDOW_MIN_WIDTH = 600;
const EXPANDED_WINDOW_MIN_WIDTH = 840;

export type WindowSizeClass = 'compact' | 'medium' | 'expanded';

export function getWindowSizeClass(windowWidth: number): WindowSizeClass {
  if (windowWidth >= EXPANDED_WINDOW_MIN_WIDTH) {
    return 'expanded';
  }
  if (windowWidth >= MEDIUM_WINDOW_MIN_WIDTH) {
    return 'medium';
  }
  return 'compact';
}
