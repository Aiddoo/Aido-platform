import { useWindowDimensions } from 'react-native';

import { getSheetHorizontalMargin } from './get-sheet-horizontal-margin';

export function useSheetHorizontalMargin(minMargin: number): number {
  const { width: windowWidth } = useWindowDimensions();

  return getSheetHorizontalMargin(windowWidth, minMargin);
}
