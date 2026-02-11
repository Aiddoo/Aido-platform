import type { TextInputProps } from 'react-native';

export type TextAreaVariant = 'filled' | 'line';

export interface TextAreaProps extends Omit<TextInputProps, 'style'> {
  variant?: TextAreaVariant;
  label?: string;
  isDisabled?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  className?: string;
}
