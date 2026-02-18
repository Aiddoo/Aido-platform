import type { BoxProps } from '../Box/Box.types';

export interface GridItemProps extends BoxProps {
  /** 차지할 열 수 (기본값: 1) */
  colSpan?: number;
}
