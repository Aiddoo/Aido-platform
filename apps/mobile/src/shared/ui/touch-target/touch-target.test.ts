import { getTouchTargetInset, MIN_TOUCH_TARGET_PT } from './touch-target';

describe('getTouchTargetInset', () => {
  it.each([
    { visibleSizePt: 16, inset: 14 },
    { visibleSizePt: 20, inset: 12 },
    { visibleSizePt: 29, inset: 7.5 },
    { visibleSizePt: 36, inset: 4 },
  ])('$visibleSizePt pt 모양은 양쪽에 $inset pt를 더해 44pt가 된다', ({ visibleSizePt, inset }) => {
    // When
    const result = getTouchTargetInset(visibleSizePt);

    // Then
    expect(result).toBe(inset);
    expect(visibleSizePt + result * 2).toBe(MIN_TOUCH_TARGET_PT);
  });

  it.each([44, 56])('%i pt처럼 이미 44pt 이상이면 넓히지 않는다', (visibleSizePt) => {
    // When
    const result = getTouchTargetInset(visibleSizePt);

    // Then
    expect(result).toBe(0);
  });
});
