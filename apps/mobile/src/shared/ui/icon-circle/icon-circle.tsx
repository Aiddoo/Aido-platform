import type { ReactNode } from 'react';
import type { StyleProp, ViewProps, ViewStyle } from 'react-native';
import type { VariantProps } from 'tailwind-variants';

import { Box } from '../box';
import { iconCircleVariants } from './icon-circle.variants';

interface IconCircleProps extends VariantProps<typeof iconCircleVariants> {
  icon: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  pointerEvents?: ViewProps['pointerEvents'];
  accessibilityLabel?: string;
}

/** 아이콘을 담는 원. 장식이라 accessibilityLabel을 받을 때만 그림으로 읽힌다 */
export function IconCircle({
  icon,
  tone,
  accessibilityLabel,
  className,
  style,
  pointerEvents,
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
      style={style}
      pointerEvents={pointerEvents}
    >
      {icon}
    </Box>
  );
}
