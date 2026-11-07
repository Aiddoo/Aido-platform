import { scaleByFontScale } from '@src/shared/utils/scale-by-font-scale';
import { useWindowDimensions } from 'react-native';

/**
 * OS 글꼴 배율(Dynamic Type, 글꼴 크기)로 크기를 스케일링하는 함수를 반환한다. 앱 글꼴 설정(`useFontScale`)은 따르지 않는다.
 * 시스템 글꼴 크기가 바뀌면 호출한 컴포넌트가 다시 렌더링된다.
 */
export function useSystemFontScaledSize(): (size: number, ratio?: number) => number {
  const { fontScale } = useWindowDimensions();

  return (size, ratio) => scaleByFontScale(size, fontScale, ratio);
}
