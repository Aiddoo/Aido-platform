import type { ComponentType } from 'react';
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

/** Internal props used only by TextArea component, not exported publicly */
export interface TextAreaInternalProps extends TextAreaProps {
  /** BottomSheet 내부에서 withUniwind(BottomSheetTextInput) 등을 주입할 때 사용 */
  textInputComponent?: ComponentType<TextInputProps>;
}
