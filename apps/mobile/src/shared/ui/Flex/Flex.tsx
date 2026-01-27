import { cn } from '@src/shared/utils/cn';
import { View } from 'react-native';
import type { FlexProps } from './Flex.types';
import { flexVariants } from './Flex.variants';

export function Flex({
  direction,
  wrap,
  justify,
  align,
  flex,
  gap,
  p,
  px,
  py,
  pt,
  pb,
  pl,
  pr,
  m,
  mx,
  my,
  mt,
  mb,
  ml,
  mr,
  className,
  style,
  children,
  ...props
}: FlexProps) {
  const spacingStyle = {
    ...(flex !== undefined && { flex }),
    ...(gap !== undefined && { gap }),
    ...(p !== undefined && { padding: p }),
    ...(px !== undefined && { paddingHorizontal: px }),
    ...(py !== undefined && { paddingVertical: py }),
    ...(pt !== undefined && { paddingTop: pt }),
    ...(pb !== undefined && { paddingBottom: pb }),
    ...(pl !== undefined && { paddingLeft: pl }),
    ...(pr !== undefined && { paddingRight: pr }),
    ...(m !== undefined && { margin: m }),
    ...(mx !== undefined && { marginHorizontal: mx }),
    ...(my !== undefined && { marginVertical: my }),
    ...(mt !== undefined && { marginTop: mt }),
    ...(mb !== undefined && { marginBottom: mb }),
    ...(ml !== undefined && { marginLeft: ml }),
    ...(mr !== undefined && { marginRight: mr }),
  };

  return (
    <View
      className={cn(flexVariants({ direction, wrap, justify, align }), className)}
      style={[spacingStyle, style]}
      {...props}
    >
      {children}
    </View>
  );
}
