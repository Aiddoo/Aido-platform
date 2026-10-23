import type { BoxProps } from '../box/box.types';

export interface GridItemProps extends BoxProps {
  /** 차지할 열 수 (기본값: 1) */
  colSpan?: number;
}
