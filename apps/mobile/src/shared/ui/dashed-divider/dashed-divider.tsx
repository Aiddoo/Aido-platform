import { cn } from '@src/shared/utils/cn';
import type { ComponentProps } from 'react';

import { Box } from '../box';

export type DashedDividerProps = Omit<ComponentProps<typeof Box>, 'children'>;

export function DashedDivider({ className, ...props }: DashedDividerProps) {
  return (
    <Box
      accessibilityElementsHidden
      importantForAccessibility="no"
      className={cn('border-b border-dashed border-gray-3', className)}
      {...props}
    />
  );
}
