import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getSheetHorizontalMargins,
  type SheetHorizontalMargins,
} from './get-sheet-horizontal-margins';

export function useSheetHorizontalMargins(minMargin: number): SheetHorizontalMargins {
  const { width: windowWidth } = useWindowDimensions();
  const { left, right } = useSafeAreaInsets();

  return getSheetHorizontalMargins(windowWidth, { left, right }, minMargin);
}
