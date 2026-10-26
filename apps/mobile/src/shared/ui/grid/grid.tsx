import { Children, createContext, isValidElement, useContext } from 'react';

import { Flex } from '../flex/flex';
import { gridStartColumns } from './grid-layout';
import type { GridProps } from './grid.types';

const GridContext = createContext(1);
export const useGridColumns = () => useContext(GridContext);

/** 열 간격과 이 칸의 시작 열. GridItem이 좌우 padding으로 간격을 만든다 */
const GridCellContext = createContext({ columnGap: 0, startColumn: 0 });
export const useGridCell = () => useContext(GridCellContext);

function readColSpan(child: unknown) {
  return isValidElement<{ colSpan?: number }>(child) ? (child.props.colSpan ?? 1) : 1;
}

export function Grid({
  columns = 1,
  gap,
  rowGap,
  columnGap,
  style,
  children,
  ...props
}: GridProps) {
  // columnGap은 flex gap으로 주면 50% 칸 두 개가 한 줄을 넘쳐 줄바꿈된다. GridItem padding으로 대신 만든다
  const resolvedColumnGap = columnGap ?? gap ?? 0;
  const resolvedRowGap = rowGap ?? gap;
  const cells = Children.toArray(children);
  const startColumns = gridStartColumns(cells.map(readColSpan), columns);

  return (
    <GridContext.Provider value={columns}>
      <Flex
        direction="row"
        wrap="wrap"
        style={[resolvedRowGap != null && { rowGap: resolvedRowGap }, style]}
        {...props}
      >
        {cells.map((cell, index) => (
          <GridCellContext.Provider
            key={isValidElement(cell) && cell.key != null ? cell.key : index}
            value={{ columnGap: resolvedColumnGap, startColumn: startColumns[index] ?? 0 }}
          >
            {cell}
          </GridCellContext.Provider>
        ))}
      </Flex>
    </GridContext.Provider>
  );
}
