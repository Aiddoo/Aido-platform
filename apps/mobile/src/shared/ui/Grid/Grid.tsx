import { createContext, useContext } from 'react';
import { Flex } from '../Flex/Flex';
import type { GridProps } from './Grid.types';

const GridContext = createContext(1);
export const useGridColumns = () => useContext(GridContext);

export function Grid({ columns = 1, rowGap, columnGap, style, ...props }: GridProps) {
  const gapStyle = {
    ...(rowGap !== undefined && { rowGap }),
    ...(columnGap !== undefined && { columnGap }),
  };

  return (
    <GridContext.Provider value={columns}>
      <Flex direction="row" wrap="wrap" style={[gapStyle, style]} {...props} />
    </GridContext.Provider>
  );
}
