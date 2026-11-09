import { cn } from '@src/shared/utils/cn';

import { Box } from '../box/box';
import type { FlexProps } from './flex.types';
import { flexVariants } from './flex.variants';

export function Flex({ direction, wrap, justify, align, className, ...props }: FlexProps) {
  return (
    <Box className={cn(flexVariants({ direction, wrap, justify, align }), className)} {...props} />
  );
}
