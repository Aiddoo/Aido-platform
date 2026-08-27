import type { ComponentType, ReactNode } from 'react';
import type { TextInputProps } from 'react-native';

export type InputVariant = 'filled' | 'line';
export type InputSize = 'medium' | 'large';

export interface InputProps extends TextInputProps {
  variant?: InputVariant;
  size?: InputSize;
  label?: string;
  isDisabled?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  renderErrorMessage?: boolean;
  leftContent?: ReactNode;
  rightContent?: ReactNode;
  className?: string;
}

export interface InputInternalProps extends InputProps {
  textInputComponent?: ComponentType<TextInputProps>;
}
