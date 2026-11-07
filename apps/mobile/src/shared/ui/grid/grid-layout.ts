/**
 * Grid 칸 배치 계산.
 *
 * RN(Yoga)에는 `calc(50% - 5px)`가 없어 `width: 50%` 칸에 columnGap을 더하면 한 줄을 넘쳐 다음 줄로 내려간다.
 * 그래서 칸 폭은 퍼센트 그대로 두고, 열 간격은 시작 열에 따라 나눈 좌우 padding으로 만든다.
 * 열 k(0부터)의 paddingLeft = g·k/c, paddingRight = g·(c−k−1)/c 이고,
 * 안쪽 폭은 (W − g·(c−1))/c 로 모든 칸이 같다. 이웃한 칸 사이 간격은 늘 g다.
 */

export interface GridItemLayout {
  width: `${number}%`;
  paddingLeft: number;
  paddingRight: number;
}

export function getGridItemLayout({
  columns,
  columnGap,
  startColumn,
}: {
  columns: number;
  columnGap: number;
  startColumn: number;
}): GridItemLayout {
  return {
    width: `${(1 / columns) * 100}%`,
    paddingLeft: (columnGap * startColumn) / columns,
    paddingRight: (columnGap * (columns - startColumn - 1)) / columns,
  };
}
