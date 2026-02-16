import { Box } from '../Box/Box';
import { useGridColumns } from './Grid';
import type { GridItemProps } from './GridItem.types';

function toPercent(value: number): `${number}%` {
  return `${value}%`;
}

export function GridItem({ colSpan = 1, style, ...props }: GridItemProps) {
  const columns = useGridColumns();
  const widthPercent = toPercent((colSpan / columns) * 100);

  return <Box style={[{ width: widthPercent }, style]} {...props} />;
}
