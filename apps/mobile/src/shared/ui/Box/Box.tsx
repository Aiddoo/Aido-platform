import { View } from 'react-native';
import type { BoxProps } from './Box.types';

export function Box({
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
}: BoxProps) {
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
    <View className={className} style={[spacingStyle, style]} {...props}>
      {children}
    </View>
  );
}
