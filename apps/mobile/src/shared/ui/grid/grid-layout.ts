import { clamp } from 'es-toolkit';

// RN(Yoga)에는 `calc(50% - 5px)`가 없어 `width: 50%` 칸에 columnGap을 더하면 한 줄을 넘친다. 칸 폭은 퍼센트 그대로 두고 열 간격은 시작 열에 따라 나눈 좌우 padding으로 만든다
// 열 k에서 colSpan s칸이면 paddingLeft = g·k/c, paddingRight = g·(c−k−s)/c 이고 이웃한 칸 사이 간격은 늘 g다

export interface GridItemLayout {
  width: `${number}%`;
  paddingLeft: number;
  paddingRight: number;
}

/** 열 수를 넘는 colSpan은 한 줄 전체로 본다 */
function clampSpan(colSpan: number, columns: number) {
  return clamp(colSpan, 1, columns);
}

/** 순서대로 놓인 칸들의 시작 열. 남은 열에 들어가지 않으면 다음 줄 첫 열에서 시작한다 */
export function getGridStartColumns(colSpans: readonly number[], columns: number): number[] {
  return colSpans.reduce<{ starts: number[]; cursor: number }>(
    ({ starts, cursor }, colSpan) => {
      const span = clampSpan(colSpan, columns);
      const start = cursor + span > columns ? 0 : cursor;
      return { starts: [...starts, start], cursor: (start + span) % columns };
    },
    { starts: [], cursor: 0 },
  ).starts;
}

export function getGridItemLayout({
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
