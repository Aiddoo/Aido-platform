import { cn } from '@src/shared/utils/cn';

import { Box } from '../box/box';

export function DashedDivider({ className }: { className?: string }) {
  return (
    <Box
      accessibilityElementsHidden
      importantForAccessibility="no"
      className={cn('border-b border-dashed border-gray-3', className)}
    />
  );
}
