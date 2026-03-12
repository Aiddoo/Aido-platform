import { PixelRatio } from 'react-native';

/**
 * 시스템 글꼴 크기에 비례하여 값을 스케일링한다.
 * 글꼴 스케일 변화량의 일부(ratio)만 반영하여 과도한 확대를 방지한다.
 *
 * @param size 기본 크기 (px)
 * @param ratio 글꼴 스케일 반영 비율 (0~1, 기본 0.5)
 */
export const fontScaledSize = (size: number, ratio = 0.5): number => {
  const fontScale = PixelRatio.getFontScale();

  return Math.round(size * (1 + (fontScale - 1) * ratio));
};
