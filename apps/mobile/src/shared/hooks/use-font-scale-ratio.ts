import { useFontScale } from '@src/shared/providers/font-scale-provider';
import { getScaledFontSize } from '@src/shared/utils/scaled-font-style';

/** Text는 시스템 글꼴 배율을 쓰지 않으므로 아이콘·고정 폭도 이 배율로 맞춘다 */
export function useFontScaleRatio(): number {
  const { fontScale } = useFontScale();
  return getScaledFontSize(fontScale) / getScaledFontSize('medium');
}
