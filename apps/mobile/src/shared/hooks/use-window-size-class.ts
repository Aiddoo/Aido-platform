import { useWindowDimensions } from 'react-native';

import { IS_IOS_APP_ON_MAC } from '../infra/device/device-info';
import { getWindowSizeClass, type WindowSizeClass } from '../utils/get-window-size-class';

/** 힌지 상태는 레이아웃에 쓰지 않고, Mac(Designed for iPad)은 창 폭과 관계없이 모바일 레이아웃을 유지한다 */
export function useWindowSizeClass(): WindowSizeClass {
  const { width: windowWidth } = useWindowDimensions();

  return IS_IOS_APP_ON_MAC ? 'compact' : getWindowSizeClass(windowWidth);
}
