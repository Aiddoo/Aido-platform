import { clsx } from 'clsx';
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
    <View
      className={clsx(flexVariants({ direction, wrap, justify, align }), className)}
      style={[spacingStyle, style]}
      {...props}
    >
      {children}
    </View>
  );
}
