import type { TextProps as RNTextProps } from 'react-native';

export type TextColor =
  | 'foreground'
  | 'muted'
  | 'accent'
  | 'danger'
  | 'main'
  | 'secondary'
  | 'error'
  | 'gray-1'
  | 'gray-2'
  | 'gray-3'
  | 'gray-4'
  | 'gray-5'
  | 'gray-6'
  | 'gray-7'
  | 'gray-8'
  | 'gray-9'
  | 'gray-10';

export type TextWeight = 'normal' | 'medium' | 'semibold' | 'bold';
export type TextSize = 'h1' | 't1' | 't2' | 't3' | 'b1' | 'b2' | 'b3' | 'b4' | 'e1' | 'e2';
export type TextAlign = 'left' | 'center' | 'right';

export interface TextProps extends Omit<RNTextProps, 'style'> {
  color?: TextColor;
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
