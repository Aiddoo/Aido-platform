import type { Edge, EdgeInsets } from 'react-native-safe-area-context';

interface SafeAreaPadding {
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
}

/** 고른 가장자리에만 inset을 padding으로 준다. 네이티브 `SafeAreaView`의 `edges`와 같은 셈이다 */
export function getSafeAreaPadding(insets: EdgeInsets, edges: readonly Edge[]): SafeAreaPadding {
  const insetAt = (edge: Edge) => (edges.includes(edge) ? insets[edge] : 0);

  return {
    paddingTop: insetAt('top'),
    paddingRight: insetAt('right'),
    paddingBottom: insetAt('bottom'),
    paddingLeft: insetAt('left'),
  };
}
