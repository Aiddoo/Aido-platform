/**
 * Grid 칸 배치 계산.
 *
 * RN(Yoga)에는 `calc(50% - 5px)`가 없어 `width: 50%` 칸에 columnGap을 더하면 한 줄을 넘쳐 다음 줄로 내려간다.
 * 그래서 칸 폭은 퍼센트 그대로 두고, 열 간격은 시작 열에 따라 나눈 좌우 padding으로 만든다.
 * 열 k(0부터)에서 colSpan s칸을 차지하면 paddingLeft = g·k/c, paddingRight = g·(c−k−s)/c 이고,
 * 안쪽 폭은 (s·W − g·(c−s))/c 로 s칸 + (s−1)개 간격과 같다. 이웃한 칸 사이 간격은 늘 g다.
 */

export interface GridItemLayout {
  width: `${number}%`;
  paddingLeft: number;
  paddingRight: number;
}

/** 열 수를 넘는 colSpan은 한 줄 전체로 본다 */
function clampSpan(colSpan: number, columns: number) {
  return Math.min(Math.max(colSpan, 1), columns);
}

/** 순서대로 놓인 칸들의 시작 열. 남은 열에 들어가지 않으면 다음 줄 첫 열에서 시작한다 */
export function gridStartColumns(colSpans: readonly number[], columns: number): number[] {
  let cursor = 0;

  return colSpans.map((colSpan) => {
    const span = clampSpan(colSpan, columns);
    if (cursor + span > columns) {
      cursor = 0;
    }
    const start = cursor;
    cursor = (cursor + span) % columns;
    return start;
  });
}

export function gridItemLayout({
  columns,
  columnGap,
  startColumn,
  colSpan,
}: {
  columns: number;
  columnGap: number;
  startColumn: number;
  colSpan: number;
}): GridItemLayout {
  const span = clampSpan(colSpan, columns);

  return {
    width: `${(span / columns) * 100}%`,
    paddingLeft: (columnGap * startColumn) / columns,
    paddingRight: (columnGap * (columns - startColumn - span)) / columns,
  };
}
