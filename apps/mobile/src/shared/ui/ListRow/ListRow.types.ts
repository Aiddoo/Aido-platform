import type { ReactNode } from 'react';
import type { ViewProps } from 'react-native';
import type { TextProps } from '../Text/Text.types';

export type ListRowVerticalPadding = 'small' | 'medium' | 'large' | 'xlarge';
export type ListRowHorizontalPadding = 'small' | 'medium' | 'none';
export type ListRowBorder = 'indented' | 'none';
export type ListRowAlignment = 'top' | 'center';

export interface ListRowProps extends Omit<ViewProps, 'children'> {
  left?: ReactNode;
  contents?: ReactNode;
  right?: ReactNode;
  verticalPadding?: ListRowVerticalPadding;
  horizontalPadding?: ListRowHorizontalPadding;
  border?: ListRowBorder;
  leftAlignment?: ListRowAlignment;
  rightAlignment?: ListRowAlignment;
  disabled?: boolean;
  className?: string;
}

export type ListRowTextsType = '1Row' | '2Row' | '3Row' | 'Right1Row' | 'Right2Row' | 'Right3Row';

export interface ListRowTextsProps {
  type?: ListRowTextsType;
  top: ReactNode;
  topProps?: Omit<TextProps, 'children'>;
  middle?: ReactNode;
  middleProps?: Omit<TextProps, 'children'>;
  bottom?: ReactNode;
  bottomProps?: Omit<TextProps, 'children'>;
}

export interface ListRowIconProps {
  children: ReactNode;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}
