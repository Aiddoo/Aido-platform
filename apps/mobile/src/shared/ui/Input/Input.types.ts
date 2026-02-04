import type { ReactNode } from 'react';
import type { TextInputProps } from 'react-native';

export type InputVariant = 'filled' | 'line';
export type InputSize = 'medium' | 'large';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  variant?: InputVariant;
  size?: InputSize;
  label?: string;
  isDisabled?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  leftContent?: ReactNode;
  rightContent?: ReactNode;
  className?: string;
}
