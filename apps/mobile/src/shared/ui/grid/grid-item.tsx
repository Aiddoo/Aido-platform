import { Box } from '../box/box';
import { useGridCell, useGridColumns } from './grid';
import type { GridItemProps } from './grid-item.types';
import { gridItemLayout } from './grid-layout';

export function GridItem({ colSpan = 1, style, ...props }: GridItemProps) {
  const columns = useGridColumns();
  const { columnGap, startColumn } = useGridCell();
  const { width, paddingLeft, paddingRight } = gridItemLayout({
    columns,
    columnGap,
    startColumn,
    colSpan,
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
