/** Apple HIG 최소 누름 크기. 보이는 모양이 이보다 작으면 hitSlop으로 채운다 */
export const MIN_TOUCH_TARGET_PT = 44;

/** 한 축의 보이는 크기를 `MIN_TOUCH_TARGET_PT`로 채우는 한쪽 hitSlop. 이미 넘으면 0이다 */
export function getTouchTargetInset(visibleSizePt: number): number {
  return Math.max(0, (MIN_TOUCH_TARGET_PT - visibleSizePt) / 2);
}
