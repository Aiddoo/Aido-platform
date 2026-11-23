import type { ColorValue } from 'react-native';
import { useResolveClassNames } from 'uniwind';

import { SHEET_RADIUS } from './bottom-sheet.constants';

interface SheetSurface {
  backgroundColor: ColorValue | undefined;
  cornerRadius: number;
  grabberOptions: { color: ColorValue | undefined };
}

/** 모든 시트가 같은 면 색·모서리·손잡이를 쓴다. 불투명한 색을 주므로 iOS 26 Liquid Glass 재질 대신 앱 면 색이 보인다 */
export function useSheetSurface(): SheetSurface {
  const { backgroundColor } = useResolveClassNames('bg-white dark:bg-gray-1');
  const { backgroundColor: grabberColor } = useResolveClassNames('bg-gray-4');

  return {
    backgroundColor,
    cornerRadius: SHEET_RADIUS,
    grabberOptions: { color: grabberColor },
  };
}
