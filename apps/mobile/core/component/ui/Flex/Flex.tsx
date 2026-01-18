import { clsx } from 'clsx';
import { View } from 'react-native';
import type { FlexProps } from './Flex.types';
import { flexVariants } from './Flex.variants';

export function Flex({
  direction,
  wrap,
  justify,
  align,
  gap,
  className,
  style,
  children,
  ...props
}: FlexProps) {
  return (
    <View
      className={clsx(flexVariants({ direction, wrap, justify, align }), className)}
      style={[gap !== undefined ? { gap } : undefined, style]}
      {...props}
    >
      {children}
    </View>
  );
}
