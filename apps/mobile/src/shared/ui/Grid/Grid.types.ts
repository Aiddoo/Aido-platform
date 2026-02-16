import type { FlexProps } from '../Flex/Flex.types';

export interface GridProps extends Omit<FlexProps, 'direction' | 'wrap'> {
  /** 열 개수 (기본값: 1) */
  columns?: number;
  /** 행 간격 (px) */
  rowGap?: number;
  /** 열 간격 (px) */
  columnGap?: number;
}
