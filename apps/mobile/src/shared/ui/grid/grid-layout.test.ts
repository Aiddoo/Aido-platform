import { gridItemLayout, gridStartColumns } from './grid-layout';

/** 컨테이너 폭 W에서 각 칸의 [안쪽 시작, 안쪽 끝]을 구한다 */
function contentRanges(
  width: number,
  columns: number,
  columnGap: number,
  colSpans: number[],
): [number, number][] {
  const starts = gridStartColumns(colSpans, columns);

  return colSpans.map((colSpan, index) => {
    const startColumn = starts[index] ?? 0;
    const layout = gridItemLayout({ columns, columnGap, startColumn, colSpan });
    const outerLeft = (width * startColumn) / columns;
    const outerWidth = (width * Number.parseFloat(layout.width)) / 100;
    return [outerLeft + layout.paddingLeft, outerLeft + outerWidth - layout.paddingRight];
  });
}

describe('gridStartColumns', () => {
  it('열 수만큼 채우면 다음 줄 첫 열로 돌아간다', () => {
    expect(gridStartColumns([1, 1, 1, 1, 1], 2)).toEqual([0, 1, 0, 1, 0]);
  });

  it('남은 열에 colSpan이 들어가지 않으면 다음 줄에서 시작한다', () => {
    expect(gridStartColumns([1, 1, 2, 1], 3)).toEqual([0, 1, 0, 2]);
  });

  it('열 수를 넘는 colSpan은 한 줄 전체를 차지한다', () => {
    expect(gridStartColumns([5, 1], 3)).toEqual([0, 0]);
  });
});

describe('gridItemLayout', () => {
  it('간격이 없으면 padding 없이 퍼센트 폭만 준다', () => {
    expect(gridItemLayout({ columns: 3, columnGap: 0, startColumn: 1, colSpan: 1 })).toEqual({
      width: '33.33333333333333%',
      paddingLeft: 0,
      paddingRight: 0,
    });
  });

  it('2열·간격 10이면 두 칸이 같은 폭으로 한 줄에 놓이고 사이가 10이다', () => {
    const [left, right] = contentRanges(362, 2, 10, [1, 1]);

    expect(left).toEqual([0, 176]);
    expect(right).toEqual([186, 362]);
  });

  it('3열에서도 모든 칸의 폭이 같고 이웃 간격은 늘 columnGap이다', () => {
    const ranges = contentRanges(300, 3, 12, [1, 1, 1]);
    const widths = ranges.map(([start, end]) => end - start);

    expect(widths.every((width) => Math.abs(width - (300 - 24) / 3) < 1e-9)).toBe(true);
    expect(ranges[0]?.[0]).toBe(0);
    expect(ranges[2]?.[1]).toBeCloseTo(300);
    expect((ranges[1]?.[0] ?? 0) - (ranges[0]?.[1] ?? 0)).toBeCloseTo(12);
    expect((ranges[2]?.[0] ?? 0) - (ranges[1]?.[1] ?? 0)).toBeCloseTo(12);
  });

  it('colSpan 칸은 칸 s개와 사이 간격 s-1개를 합친 폭이다', () => {
    const [wide, narrow] = contentRanges(300, 3, 12, [2, 1]);
    const column = (300 - 24) / 3;

    expect((wide?.[1] ?? 0) - (wide?.[0] ?? 0)).toBeCloseTo(column * 2 + 12);
    expect((narrow?.[1] ?? 0) - (narrow?.[0] ?? 0)).toBeCloseTo(column);
  });
});
