import type { ComponentRef, Ref } from 'react';
import type { View, ViewProps } from 'react-native';

export interface BoxProps extends ViewProps {
  ref?: Ref<ComponentRef<typeof View>>;
  flex?: number;
  gap?: number;
  p?: number;
  px?: number;
  py?: number;
  pt?: number;
  pb?: number;
  pl?: number;
  pr?: number;
  m?: number;
  mx?: number;
  my?: number;
  mt?: number;
  mb?: number;
  ml?: number;
  mr?: number;
  className?: string;
}
