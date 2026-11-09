import { getStampPressStartProgress } from './stamp-press';

describe('getStampPressStartProgress', () => {
  it('동작 줄이기가 켜져 있으면 찍힌 모습에서 시작해 재생하지 않는다', () => {
    // When
    const progress = getStampPressStartProgress(true);

    // Then
    expect(progress).toBe(1);
  });

  it('동작 줄이기가 꺼져 있으면 떠 있는 모습에서 시작해 한 번 찍는다', () => {
    // When
    const progress = getStampPressStartProgress(false);

    // Then
    expect(progress).toBe(0);
  });
});
