import { View, type ViewStyle } from 'react-native';

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
  // 빈번히 렌더링되는 저수준 컴포넌트 — 스프레드 대신 직접 할당으로 임시 객체 생성 최소화
  const spacingStyle: ViewStyle = {};
  if (flex !== undefined) {
    spacingStyle.flex = flex;
  }
  if (gap !== undefined) {
    spacingStyle.gap = gap;
  }
  if (p !== undefined) {
    spacingStyle.padding = p;
  }
  if (px !== undefined) {
    spacingStyle.paddingHorizontal = px;
  }
  if (py !== undefined) {
    spacingStyle.paddingVertical = py;
  }
  if (pt !== undefined) {
    spacingStyle.paddingTop = pt;
  }
  if (pb !== undefined) {
    spacingStyle.paddingBottom = pb;
  }
  if (pl !== undefined) {
    spacingStyle.paddingLeft = pl;
  }
  if (pr !== undefined) {
    spacingStyle.paddingRight = pr;
  }
  if (m !== undefined) {
    spacingStyle.margin = m;
  }
  if (mx !== undefined) {
    spacingStyle.marginHorizontal = mx;
  }
  if (my !== undefined) {
    spacingStyle.marginVertical = my;
  }
  if (mt !== undefined) {
    spacingStyle.marginTop = mt;
  }
  if (mb !== undefined) {
    spacingStyle.marginBottom = mb;
  }
  if (ml !== undefined) {
    spacingStyle.marginLeft = ml;
  }
  if (mr !== undefined) {
    spacingStyle.marginRight = mr;
  }

  return (
    <View className={className} style={[spacingStyle, style]} {...props}>
      {children}
    </View>
  );
}
