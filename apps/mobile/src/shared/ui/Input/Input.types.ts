import type { ComponentType, ReactNode } from 'react';
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

/** Internal props used only by Input component, not exported publicly */
export interface InputInternalProps extends InputProps {
  /** BottomSheet 내부에서 withUniwind(BottomSheetTextInput) 등을 주입할 때 사용 */
  textInputComponent?: ComponentType<TextInputProps>;
}
