import { scaleByFontScale } from '@src/shared/utils/scale';
import { useWindowDimensions } from 'react-native';

/**
 * 현재 시스템 글꼴 배율로 크기를 스케일링하는 함수를 반환한다.
 * 시스템 글꼴 크기가 바뀌면 호출한 컴포넌트가 다시 렌더링된다.
 */
export function useFontScaledSize(): (size: number, ratio?: number) => number {
  const { fontScale } = useWindowDimensions();

  return (size, ratio) => scaleByFontScale(size, fontScale, ratio);
}
