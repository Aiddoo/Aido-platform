/**
 * 시스템 글꼴 배율에 비례하여 값을 스케일링한다.
 * 글꼴 배율 변화량의 일부(ratio)만 반영하여 과도한 확대를 방지한다.
 *
 * @param size 기본 크기 (px)
 * @param fontScale 시스템 글꼴 배율
 * @param ratio 글꼴 배율 반영 비율 (0~1, 기본 0.5)
 */
export const scaleByFontScale = (size: number, fontScale: number, ratio = 0.5): number =>
  Math.round(size * (1 + (fontScale - 1) * ratio));
