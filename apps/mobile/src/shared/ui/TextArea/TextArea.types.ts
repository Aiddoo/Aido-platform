import type { ComponentType } from 'react';
import type { TextInputProps } from 'react-native';

import type { TextSize } from '../Text/Text.types';

export type TextAreaVariant = 'filled' | 'line' | 'plain';

export interface TextAreaProps extends TextInputProps {
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
