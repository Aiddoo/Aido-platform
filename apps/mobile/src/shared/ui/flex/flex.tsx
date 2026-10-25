import { cn } from '@src/shared/utils/cn';
import { View } from 'react-native';

import type { FlexProps } from './flex.types';
import { flexVariants } from './flex.variants';

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
    ...(flex != null && { flex }),
    ...(gap != null && { gap }),
    ...(p != null && { padding: p }),
    ...(px != null && { paddingHorizontal: px }),
    ...(py != null && { paddingVertical: py }),
    ...(pt != null && { paddingTop: pt }),
    ...(pb != null && { paddingBottom: pb }),
    ...(pl != null && { paddingLeft: pl }),
    ...(pr != null && { paddingRight: pr }),
    ...(m != null && { margin: m }),
    ...(mx != null && { marginHorizontal: mx }),
    ...(my != null && { marginVertical: my }),
    ...(mt != null && { marginTop: mt }),
    ...(mb != null && { marginBottom: mb }),
    ...(ml != null && { marginLeft: ml }),
    ...(mr != null && { marginRight: mr }),
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
