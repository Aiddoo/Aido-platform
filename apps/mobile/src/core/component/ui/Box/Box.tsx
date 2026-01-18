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
    flex,
    gap,
    padding: p,
    paddingHorizontal: px,
    paddingVertical: py,
    paddingTop: pt,
    paddingBottom: pb,
    paddingLeft: pl,
    paddingRight: pr,
    margin: m,
    marginHorizontal: mx,
    marginVertical: my,
    marginTop: mt,
    marginBottom: mb,
    marginLeft: ml,
    marginRight: mr,
  };

  return (
    <View className={className} style={[spacingStyle, style]} {...props}>
      {children}
    </View>
  );
}
