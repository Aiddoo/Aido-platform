/** 글꼴 배율 변화량의 일부(ratio)만 반영해 과도한 확대를 막는다 */
export function scaleByFontScale(size: number, fontScaleRatio: number, ratio = 0.5): number {
  return Math.round(size * (1 + (fontScaleRatio - 1) * ratio));
}
