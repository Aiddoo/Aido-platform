import type { PressableFeedback } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';
import type { PressableProps } from 'react-native';

export type TextButtonSize = 'xsmall' | 'small' | 'medium' | 'large' | 'xlarge';
export type TextButtonVariant = 'clear' | 'underline' | 'arrow';

export interface TextButtonProps extends Omit<
  ComponentProps<typeof PressableFeedback>,
  'children' | 'onPress'
> {
  children: ReactNode;
  onPress?: PressableProps['onPress'];
  size?: TextButtonSize;
  variant?: TextButtonVariant;
  isDisabled?: boolean;
  className?: string;
}
