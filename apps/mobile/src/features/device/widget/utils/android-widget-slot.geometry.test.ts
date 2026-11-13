import { getAndroidWidgetSlotSize } from './android-widget-slot.geometry';

describe('getAndroidWidgetSlotSize', () => {
  it.each([
    { title: '폭이 NaN·높이가 0이면 작은 카드 디자인 크기로 그린다', width: NaN, height: 0 },
    { title: '음수 크기도 디자인 크기로 그린다', width: -1, height: -1 },
  ])('$title', ({ width, height }) => {
    // When
    const size = getAndroidWidgetSlotSize({ width, height }, { isSmall: true, isLarge: false });

    // Then
    expect(size).toEqual({ width: 160, height: 160 });
  });

  it('런처가 준 크기가 있으면 그대로 쓴다', () => {
    // When
    const size = getAndroidWidgetSlotSize(
      { width: 374, height: 420 },
      { isSmall: false, isLarge: true },
    );

    // Then
    expect(size).toEqual({ width: 374, height: 420 });
  });
});
