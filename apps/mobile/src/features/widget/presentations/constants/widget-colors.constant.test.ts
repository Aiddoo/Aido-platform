import { toWidgetRgbaColor } from './widget-colors.constant';

describe('toWidgetRgbaColor', () => {
  it('HEX 색상을 alpha가 적용된 rgba로 변환한다', () => {
    expect(toWidgetRgbaColor('#B3E5C1', '#5AC27A', 0.25)).toBe('rgba(179, 229, 193, 0.25)');
  });

  it('잘못된 색상과 alpha를 안전한 범위로 정규화한다', () => {
    expect(toWidgetRgbaColor('invalid', '#5AC27A', 2)).toBe('rgba(90, 194, 122, 1)');
  });
});
