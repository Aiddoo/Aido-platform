import { Box } from '../box/box';
import { useGridCell, useGridColumns } from './grid';
import type { GridItemProps } from './grid-item.types';
import { getGridItemLayout } from './grid-layout';

export function GridItem({ style, ...props }: GridItemProps) {
  const columns = useGridColumns();
  const { columnGap, startColumn } = useGridCell();
  const { width, paddingLeft, paddingRight } = getGridItemLayout({
    columns,
    columnGap,
    startColumn,
  });

  if (columnGap === 0) {
    return <Box style={[{ width }, style]} {...props} />;
  }

  // 바깥 칸이 퍼센트 폭과 간격 padding을 갖고, 배경·테두리 같은 스타일은 간격 안쪽 칸에만 준다
  return (
    <Box style={{ width, paddingLeft, paddingRight }}>
      <Box style={[{ flexGrow: 1 }, style]} {...props} />
    </Box>
  );
}
