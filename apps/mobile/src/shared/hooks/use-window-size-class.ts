import { useWindowDimensions } from 'react-native';

import { getWindowSizeClass, type WindowSizeClass } from '../utils/window-size-class';

/** 접힘·펼침·분할 화면에서 바뀌는 현재 창 폭을 size class로 반환한다. 힌지 상태는 레이아웃에 쓰지 않는다. */
export function useWindowSizeClass(): WindowSizeClass {
  const { width: windowWidth } = useWindowDimensions();

  return getWindowSizeClass(windowWidth);
}
