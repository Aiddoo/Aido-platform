import type { ViewProps } from 'react-native';
import type { VariantProps } from 'tailwind-variants';

import type { flexVariants } from './Flex.variants';

type FlexVariantProps = VariantProps<typeof flexVariants>;

export type FlexDirection = FlexVariantProps['direction'];
export type FlexWrap = FlexVariantProps['wrap'];
export type FlexJustify = FlexVariantProps['justify'];
export type FlexAlign = FlexVariantProps['align'];

export interface FlexProps extends ViewProps {
  direction?: FlexDirection;
  wrap?: FlexWrap;
  justify?: FlexJustify;
  align?: FlexAlign;
  gap?: number;
  className?: string;
}
