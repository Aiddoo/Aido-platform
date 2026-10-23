import type { TextProps as RNTextProps } from 'react-native';

export type TextTone = 'neutral' | 'brand' | 'danger' | 'warning' | 'success' | 'info' | 'white';
export type TextShade = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type TextWeight = 'normal' | 'medium' | 'semibold' | 'bold';
export type TextSize = 'h1' | 't1' | 't2' | 't3' | 'b1' | 'b2' | 'b3' | 'b4' | 'e1' | 'e2';
export type TextAlign = 'left' | 'center' | 'right';

export interface TextProps extends Omit<RNTextProps, 'style'> {
  tone?: TextTone;
  shade?: TextShade;
  weight?: TextWeight;
  size?: TextSize;
  align?: TextAlign;
  maxLines?: number;
  strikethrough?: boolean;
  underline?: boolean;
  className?: string;
  style?: RNTextProps['style'];
  children?: React.ReactNode;
}

export interface HeadingProps extends TextProps {
  emphasize?: boolean;
}

export interface H1Props extends HeadingProps {
  headline?: string;
}
