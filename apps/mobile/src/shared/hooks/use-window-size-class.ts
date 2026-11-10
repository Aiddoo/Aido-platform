import { WindowLayoutPolicy } from '@src/shared/domains/window-layout.model';

import type { WindowSizeClass } from '../utils/get-window-size-class';
import { useAppWindow } from './use-app-window';

/** 힌지 상태는 레이아웃에 쓰지 않는다 */
export function useWindowSizeClass(): WindowSizeClass {
  return WindowLayoutPolicy.getSizeClass(useAppWindow());
}
