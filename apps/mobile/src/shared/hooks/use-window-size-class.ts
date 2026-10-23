import { useWindowDimensions } from 'react-native';

/** Material window size class 기준 폭(dp). iOS regular width와도 일치한다. */
export const MEDIUM_WINDOW_MIN_WIDTH = 600;
export const EXPANDED_WINDOW_MIN_WIDTH = 840;

export type WindowSizeClass = 'compact' | 'medium' | 'expanded';

/** 접힘·펼침·분할 화면에서 바뀌는 현재 창 폭을 size class로 반환한다. 힌지 상태는 레이아웃에 쓰지 않는다. */
export function useWindowSizeClass(): WindowSizeClass {
  const { width: windowWidth } = useWindowDimensions();

  if (windowWidth >= EXPANDED_WINDOW_MIN_WIDTH) {
    return 'expanded';
  }
  if (windowWidth >= MEDIUM_WINDOW_MIN_WIDTH) {
    return 'medium';
  }
  return 'compact';
}
