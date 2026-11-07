import type { TextProps as RNTextProps } from 'react-native';

export type TextTone =
  | 'neutral'
  | 'brand'
  | 'danger'
  | 'warning'
  | 'success'
  | 'info'
  | 'white'
  | 'onSky';
export type TextShade = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
type TextWeight = 'normal' | 'medium' | 'semibold' | 'bold';
export type TextSize =
  | 'display'
  | 'h1'
  | 't1'
  | 't2'
  | 't3'
  | 'b1'
  | 'b2'
  | 'b3'
  | 'b4'
  | 'e1'
  | 'e2';
type TextAlign = 'left' | 'center' | 'right';

export interface TextProps extends Omit<RNTextProps, 'style'> {
  tone?: TextTone;
  shade?: TextShade;
  weight?: TextWeight;
  size?: TextSize;
  align?: TextAlign;
  strikethrough?: boolean;
  underline?: boolean;
  className?: string;
  style?: RNTextProps['style'];
  children?: React.ReactNode;
}
