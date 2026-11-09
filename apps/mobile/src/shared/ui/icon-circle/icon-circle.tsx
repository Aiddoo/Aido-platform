import type { ComponentProps, ReactNode } from 'react';
import type { VariantProps } from 'tailwind-variants';

import { Box } from '../box';
import { iconCircleVariants } from './icon-circle.variants';

interface IconCircleProps
  extends Omit<ComponentProps<typeof Box>, 'children'>, VariantProps<typeof iconCircleVariants> {
  icon: ReactNode;
}

/** 아이콘을 담는 원. 장식이라 accessibilityLabel을 받을 때만 그림으로 읽힌다 */
export function IconCircle({
  icon,
  tone,
  accessibilityLabel,
  className,
  ...props
}: IconCircleProps) {
  const isLabelled = accessibilityLabel != null;

  return (
    <Box
      accessible={isLabelled}
      accessibilityRole={isLabelled ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={!isLabelled}
      importantForAccessibility={isLabelled ? 'yes' : 'no-hide-descendants'}
      className={iconCircleVariants({ tone, className })}
      {...props}
    >
      {icon}
    </Box>
  );
}
