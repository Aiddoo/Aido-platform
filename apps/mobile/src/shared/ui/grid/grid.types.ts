import type { FlexProps } from '../flex/flex.types';

export interface GridProps extends Omit<FlexProps, 'direction' | 'wrap'> {
  /** 열 개수 (기본값: 1) */
  columns?: number;
}
