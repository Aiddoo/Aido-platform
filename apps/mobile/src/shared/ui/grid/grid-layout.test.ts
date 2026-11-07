import { getGridItemLayout } from './grid-layout';

/** 컨테이너 폭 W에서 각 칸의 [안쪽 시작, 안쪽 끝]을 구한다 */
function contentRanges(width: number, columns: number, columnGap: number): [number, number][] {
  return Array.from({ length: columns }, (_, startColumn) => {
    const layout = getGridItemLayout({ columns, columnGap, startColumn });
    const outerLeft = (width * startColumn) / columns;
    const outerWidth = (width * Number.parseFloat(layout.width)) / 100;
    return [outerLeft + layout.paddingLeft, outerLeft + outerWidth - layout.paddingRight];
  });
}

describe('getGridItemLayout', () => {
  it('간격이 없으면 padding 없이 퍼센트 폭만 준다', () => {
    // When
    const layout = getGridItemLayout({ columns: 3, columnGap: 0, startColumn: 1 });

    // Then
    expect(layout).toEqual({
      width: '33.33333333333333%',
      paddingLeft: 0,
      paddingRight: 0,
    });
  });

  it('2열·간격 10이면 두 칸이 같은 폭으로 한 줄에 놓이고 사이가 10이다', () => {
    // When
    const [left, right] = contentRanges(362, 2, 10);

    // Then
    expect(left).toEqual([0, 176]);
    expect(right).toEqual([186, 362]);
  });

  it('3열에서도 모든 칸의 폭이 같고 이웃 간격은 늘 columnGap이다', () => {
    // When
    const ranges = contentRanges(300, 3, 12);
    const widths = ranges.map(([start, end]) => end - start);

    // Then
    expect(widths.every((width) => Math.abs(width - (300 - 24) / 3) < 1e-9)).toBe(true);
    expect(ranges[0]?.[0]).toBe(0);
    expect(ranges[2]?.[1]).toBeCloseTo(300);
    expect((ranges[1]?.[0] ?? 0) - (ranges[0]?.[1] ?? 0)).toBeCloseTo(12);
    expect((ranges[2]?.[0] ?? 0) - (ranges[1]?.[1] ?? 0)).toBeCloseTo(12);
  });
});
