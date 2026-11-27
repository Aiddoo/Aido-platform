import { scaleByFontScale } from '@src/shared/utils/scale-by-font-scale';

import { useFontScaleRatio } from './use-font-scale-ratio';

/** Text는 OS 글꼴 배율을 쓰지 않으므로(`allowFontScaling={false}`) 아이콘·고정 크기도 앱 글자 크기 배율을 따른다 */
export function useFontScaledSize(): (size: number, ratio?: number) => number {
  const appRatio = useFontScaleRatio();

  return (size, ratio) => scaleByFontScale(size, appRatio, ratio);
}
