import { use } from 'react';
import { useWindowDimensions } from 'react-native';
import { useReservedRegions } from 'react-native-reserved-regions';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FullWindowHostContext } from './full-window-host-context';
import { getSheetLayout, type SheetLayout } from './get-sheet-layout';

interface SheetLayoutOptions {
  minMargin: number;
  /** HeroUI Portal처럼 Context를 이어받지 않는 전체 창 호스트에서만 지정한다. */
  isFullWindowHost?: boolean;
}

export function useSheetLayout({ minMargin, isFullWindowHost }: SheetLayoutOptions): SheetLayout {
  const { width: windowWidth } = useWindowDimensions();
  const { top, left, right } = useSafeAreaInsets();
  const reservedRegions = useReservedRegions();
  const isInFullWindowHost = use(FullWindowHostContext);

  return getSheetLayout({
    windowWidth,
    safeAreaInsets: { top, left, right },
    minMargin,
    isFullWindowHost: isFullWindowHost ?? isInFullWindowHost,
    reservedRegions,
  });
}
