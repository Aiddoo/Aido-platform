import type { ReactNode } from 'react';
import type { PressableProps } from 'react-native';

export type TextButtonSize = 'xsmall' | 'small' | 'medium' | 'large' | 'xlarge';
export type TextButtonVariant = 'clear' | 'underline' | 'arrow';

export interface TextButtonProps extends Omit<PressableProps, 'children'> {
  children: ReactNode;
  size?: TextButtonSize;
  variant?: TextButtonVariant;
  isDisabled?: boolean;
  className?: string;
}
