import { scaleByFontScale } from '@src/shared/utils/scale-by-font-scale';

import { useFontScaleRatio } from './use-font-scale-ratio';

/**
 * 앱 글자 크기 설정(`useFontScale`)의 배율로 크기를 스케일링하는 함수를 반환한다.
 * Text는 OS 글꼴 배율을 쓰지 않으므로(`allowFontScaling={false}`) 아이콘·고정 크기도 같은 기준을 따른다.
 */
export function useFontScaledSize(): (size: number, ratio?: number) => number {
  const appRatio = useFontScaleRatio();

  return (size, ratio) => scaleByFontScale(size, appRatio, ratio);
}
