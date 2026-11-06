import { useWindowDimensions } from 'react-native';
import { useReservedRegions } from 'react-native-reserved-regions';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getSheetLayout, type SheetLayout } from './get-sheet-layout';

export function useSheetLayout({ minMargin }: { minMargin: number }): SheetLayout {
  const { width: windowWidth } = useWindowDimensions();
  const { top: safeAreaTop } = useSafeAreaInsets();
  const reservedRegions = useReservedRegions();

  return getSheetLayout({ windowWidth, safeAreaTop, minMargin, reservedRegions });
}
