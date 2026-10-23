import type { ComponentType, Ref } from 'react';
import type { TextInputInstance, TextInputProps } from 'react-native';

import type { TextSize } from '../text/text.types';

export type TextAreaVariant = 'filled' | 'line' | 'plain';

export interface TextAreaProps extends Omit<
  TextInputProps,
  'value' | 'defaultValue' | 'onChange' | 'onChangeText'
> {
  ref?: Ref<TextInputInstance>;
  value: string;
  onChange: (value: string) => void;
  variant?: TextAreaVariant;
  label?: string;
  isDisabled?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  preserveErrorSpace?: boolean;
  textSize?: TextSize;
  growsWithContent?: boolean;
  className?: string;
}

export interface TextAreaInternalProps extends TextAreaProps {
  textInputComponent?: ComponentType<TextInputProps>;
}
