import type { VariantProps } from 'tailwind-variants';

import type { BoxProps } from '../box/box.types';
import type { flexVariants } from './flex.variants';

type FlexVariantProps = VariantProps<typeof flexVariants>;

type FlexDirection = FlexVariantProps['direction'];
type FlexWrap = FlexVariantProps['wrap'];
type FlexJustify = FlexVariantProps['justify'];
type FlexAlign = FlexVariantProps['align'];

export interface FlexProps extends BoxProps {
  direction?: FlexDirection;
  wrap?: FlexWrap;
  justify?: FlexJustify;
  align?: FlexAlign;
}
