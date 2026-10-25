import { useWindowDimensions } from 'react-native';

import { IS_IOS_APP_ON_MAC } from '../config/device';
import { getWindowSizeClass, type WindowSizeClass } from '../utils/window-size-class';

/**
 * 접힘·펼침·분할 화면에서 바뀌는 현재 창 폭을 size class로 반환한다. 힌지 상태는 레이아웃에 쓰지 않는다.
 * Mac(Designed for iPad)은 창 폭과 관계없이 모바일 레이아웃을 유지한다.
 */
export function useWindowSizeClass(): WindowSizeClass {
  const { width: windowWidth } = useWindowDimensions();

  if (IS_IOS_APP_ON_MAC) {
    return 'compact';
  }

  return getWindowSizeClass(windowWidth);
}
