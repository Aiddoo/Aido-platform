import type { VariantProps } from 'tailwind-variants';

import type { BoxProps } from '../box/box.types';
import type { flexVariants } from './flex.variants';

type FlexVariantProps = VariantProps<typeof flexVariants>;

export type FlexDirection = FlexVariantProps['direction'];
export type FlexWrap = FlexVariantProps['wrap'];
export type FlexJustify = FlexVariantProps['justify'];
export type FlexAlign = FlexVariantProps['align'];

export interface FlexProps extends BoxProps {
  direction?: FlexDirection;
  wrap?: FlexWrap;
  justify?: FlexJustify;
  align?: FlexAlign;
}
