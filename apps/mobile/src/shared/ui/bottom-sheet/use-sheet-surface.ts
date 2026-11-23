import type { ColorValue } from 'react-native';
import { useResolveClassNames } from 'uniwind';

import { SHEET_RADIUS } from './bottom-sheet.constants';

/** 손잡이 크기는 옛 시트(36×4)와 같다 */
const GRABBER_WIDTH = 36;
const GRABBER_HEIGHT = 4;

interface SheetSurface {
  backgroundColor: ColorValue | undefined;
  backgroundStyle: { backgroundColor: ColorValue | undefined };
  cornerRadius: number;
  grabberOptions: {
    color: ColorValue | undefined;
    width: number;
    height: number;
    adaptive: boolean;
  };
}

/** 모든 시트가 같은 면 색·모서리·손잡이를 쓴다 */
export function useSheetSurface(): SheetSurface {
  const { backgroundColor } = useResolveClassNames('bg-white dark:bg-gray-1');
  const { backgroundColor: grabberColor } = useResolveClassNames('bg-gray-4');

  return {
    backgroundColor,
    // iOS 26.1+는 backgroundColor를 Liquid Glass 위 색 효과로만 칠해 면 색이 달라진다. TrueSheet 문서대로 정확한 색은 backgroundStyle로 깐다
    backgroundStyle: { backgroundColor },
    cornerRadius: SHEET_RADIUS,
    // adaptive는 iOS vibrancy·Android 40% 섞기로 손잡이 색을 바꾼다
    grabberOptions: {
      color: grabberColor,
      width: GRABBER_WIDTH,
      height: GRABBER_HEIGHT,
      adaptive: false,
    },
  };
}
