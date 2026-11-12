import { WindowLayoutPolicy } from '@src/shared/ui/adaptive-pane/window-layout';
import type { WindowSizeClass } from '@src/shared/ui/adaptive-pane/window-layout';

import { useAppWindow } from './use-app-window';

/** 창 전체의 class다. iPad 탭 사이드바는 창 폭을 바꾸지 않으므로 목록·상세 칸 나누기는 `usePaneSizeClass`를 쓴다. 힌지 상태는 레이아웃에 쓰지 않는다 */
export function useWindowSizeClass(): WindowSizeClass {
  return WindowLayoutPolicy.getSizeClass(useAppWindow());
}
