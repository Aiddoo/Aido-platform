import {
  type PaneAreaMetrics,
  type PaneColumns,
  WindowLayoutPolicy,
} from '@src/shared/domains/window-layout.model';
import { useAppWindow } from '@src/shared/hooks/use-app-window';
import { findVerticalFold } from '@src/shared/utils/find-vertical-fold';
import type { WindowSizeClass } from '@src/shared/utils/get-window-size-class';
import { createContext, type PropsWithChildren, use } from 'react';
import { I18nManager } from 'react-native';
import { useReservedRegions } from 'react-native-reserved-regions';
import {
  SafeAreaProvider,
  useSafeAreaFrame,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

const OUTSIDE_PANE_AREA: PaneAreaMetrics = {
  width: null,
  leadingInset: 0,
  trailingInset: 0,
  insetsOccupyPane: false,
};

// iOS 좌우 inset은 iPad 탭 사이드바·iPhone Duo 레일이다. Android 좌우 inset은 시스템 바·컷아웃이라 크기 등급에 넣지 않는다
const INSETS_OCCUPY_PANE = process.env.EXPO_OS === 'ios';

const PaneAreaContext = createContext<PaneAreaMetrics | null>(null);

/**
 * 탭 Stack을 감싸 그 탭의 폭과 좌우 inset을 잰다. NativeTabs는 사이드바 배치를 알려 주지 않고, iPadOS 26+ 사이드바는 탭 폭을 줄이지 않고 inset으로 온다.
 * 칸 나누기와 고른 항목을 칸에 열지 push할지를 같은 값으로 정해야 둘이 어긋나지 않는다
 */
export function PaneArea({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider>
      <MeasuredPaneArea>{children}</MeasuredPaneArea>
    </SafeAreaProvider>
  );
}

function MeasuredPaneArea({ children }: PropsWithChildren) {
  const { width } = useSafeAreaFrame();
  const { left, right } = useSafeAreaInsets();
  const { isRTL } = I18nManager;

  return (
    <PaneAreaContext
      value={{
        width,
        leadingInset: isRTL ? right : left,
        trailingInset: isRTL ? left : right,
        insetsOccupyPane: INSETS_OCCUPY_PANE,
      }}
    >
      {children}
    </PaneAreaContext>
  );
}

/** `PaneArea` 밖(탭 위에 여는 화면)은 창 폭으로 정한다 */
export function usePaneArea(): PaneAreaMetrics {
  return use(PaneAreaContext) ?? OUTSIDE_PANE_AREA;
}

export function usePaneSizeClass(): WindowSizeClass {
  return WindowLayoutPolicy.getPaneSizeClass(useAppWindow(), usePaneArea());
}

/** 접힘선은 가장 가까운 `ReservedRegionsProvider`의 좌표로 잰다 */
export function usePaneColumns(): PaneColumns {
  const area = usePaneArea();
  const fold = findVerticalFold(useReservedRegions());

  return WindowLayoutPolicy.getPaneColumns(useAppWindow(), {
    ...area,
    foldX: fold?.frame.x ?? null,
  });
}
