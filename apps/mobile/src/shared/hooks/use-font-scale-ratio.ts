import { useFontScale } from '@src/shared/providers/font-scale-provider';
import { getScaledFontSize } from '@src/shared/utils/scaled-font-style';

/**
 * 앱 글자 크기 설정의 배율(보통=1). Text는 시스템 글꼴 배율을 쓰지 않으므로
 * 아이콘·고정 폭·큰 글자 배치도 이 배율 하나로 맞춘다.
 */
export function useFontScaleRatio(): number {
  const { fontScale } = useFontScale();
  return getScaledFontSize(fontScale) / getScaledFontSize('medium');
}
