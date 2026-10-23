import type { ComponentType, ReactNode, Ref } from 'react';
import type { TextInputInstance, TextInputProps } from 'react-native';

export type InputVariant = 'filled' | 'line';
export type InputSize = 'medium' | 'large';

export interface InputProps extends Omit<
  TextInputProps,
  'value' | 'defaultValue' | 'onChange' | 'onChangeText'
> {
  ref?: Ref<TextInputInstance>;
  value: string;
  onChange: (value: string) => void;
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
