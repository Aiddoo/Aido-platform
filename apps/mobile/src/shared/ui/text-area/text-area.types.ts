import type { ComponentType, ReactNode, Ref } from 'react';
import type { TextInputInstance, TextInputProps } from 'react-native';

import type { TextSize } from '../text/text.types';

export type TextAreaVariant = 'filled' | 'line' | 'plain' | 'bare';

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
  /** 오류 문구 줄 오른쪽(글자 수 등). 칸에 함께 넣어야 키보드가 올라올 때 칸과 같이 보인다 */
  counter?: ReactNode;
  preserveErrorSpace?: boolean;
  textSize?: TextSize;
  growsWithContent?: boolean;
  className?: string;
}

export interface TextAreaInternalProps extends TextAreaProps {
  textInputComponent?: ComponentType<TextInputProps>;
}
