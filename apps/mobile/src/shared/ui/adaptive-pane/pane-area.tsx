import { type PaneColumns, WindowLayoutPolicy } from '@src/shared/domains/window-layout.model';
import { useAppWindow } from '@src/shared/hooks/use-app-window';
import { findVerticalFold } from '@src/shared/utils/find-vertical-fold';
import type { WindowSizeClass } from '@src/shared/utils/get-window-size-class';
import { createContext, type PropsWithChildren, use, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { useReservedRegions } from 'react-native-reserved-regions';

import { Box } from '../box/box';

const PaneAreaWidthContext = createContext<number | null>(null);

/**
 * 탭 Stack을 감싸 그 탭이 실제로 받은 폭을 잰다. iPad에서 NativeTabs 사이드바가 열리면 창 폭은 그대로인데 탭 안이 좁아진다.
 * 칸 나누기와 고른 항목을 칸에 열지 push할지를 같은 폭으로 정해야 둘이 어긋나지 않는다
 */
export function PaneArea({ children }: PropsWithChildren) {
  const [width, setWidth] = useState<number | null>(null);

  const handleLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  return (
    <Box flex={1} onLayout={handleLayout} testID="pane-area">
      <PaneAreaWidthContext value={width}>{children}</PaneAreaWidthContext>
    </Box>
  );
}

/** `PaneArea` 밖(탭 위에 여는 화면)은 창 폭으로 정한다 */
export function usePaneSizeClass(): WindowSizeClass {
  return WindowLayoutPolicy.getPaneSizeClass(useAppWindow(), use(PaneAreaWidthContext));
}

/** 접힘선은 가장 가까운 `ReservedRegionsProvider`의 좌표로 잰다 */
export function usePaneColumns(): PaneColumns {
  const areaWidth = use(PaneAreaWidthContext);
  const fold = findVerticalFold(useReservedRegions());

  return WindowLayoutPolicy.getPaneColumns(useAppWindow(), {
    width: areaWidth,
    foldX: fold?.frame.x ?? null,
  });
}

export function usePaneAreaWidth(): number {
  const { width: windowWidth } = useAppWindow();

  return use(PaneAreaWidthContext) ?? windowWidth;
}
