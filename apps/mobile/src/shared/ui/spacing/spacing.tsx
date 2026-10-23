import type { ComponentProps } from 'react';
import { View } from 'react-native';

export interface SpacingProps extends ComponentProps<typeof View> {
  size: number;
  direction?: 'vertical' | 'horizontal';
}

export function Spacing({ size, direction = 'vertical', style, ...props }: SpacingProps) {
  const spacingStyle = direction === 'vertical' ? { height: size } : { width: size };

  return <View style={[spacingStyle, style]} {...props} />;
}
