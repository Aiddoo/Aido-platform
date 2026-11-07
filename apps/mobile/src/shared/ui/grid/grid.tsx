import { Children, createContext, isValidElement, use } from 'react';

import { Flex } from '../flex/flex';
import type { GridProps } from './grid.types';

const GridContext = createContext(1);

export function useGridColumns() {
  return use(GridContext);
}

/** 열 간격과 이 칸의 시작 열. GridItem이 좌우 padding으로 간격을 만든다 */
const GridCellContext = createContext({ columnGap: 0, startColumn: 0 });

export function useGridCell() {
  return use(GridCellContext);
}

export function Grid({ columns = 1, gap, style, children, ...props }: GridProps) {
  // 열 간격은 flex gap으로 주면 50% 칸 두 개가 한 줄을 넘쳐 줄바꿈된다. GridItem padding으로 대신 만든다
  const columnGap = gap ?? 0;
  const cells = Children.toArray(children);

  return (
    <GridContext.Provider value={columns}>
      <Flex direction="row" wrap="wrap" style={[gap != null && { rowGap: gap }, style]} {...props}>
        {cells.map((cell, index) => (
          <GridCellContext.Provider
            key={isValidElement(cell) && cell.key != null ? cell.key : index}
            value={{ columnGap, startColumn: index % columns }}
          >
            {cell}
          </GridCellContext.Provider>
        ))}
      </Flex>
    </GridContext.Provider>
  );
}
