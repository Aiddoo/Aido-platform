import type { LinkButton } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';
import type { PressableProps } from 'react-native';

type TextButtonSize = 'xsmall' | 'small' | 'medium' | 'large' | 'xlarge';
type TextButtonVariant = 'clear' | 'underline' | 'arrow';

export interface TextButtonProps extends Omit<
  ComponentProps<typeof LinkButton>,
  'children' | 'onPress' | 'size' | 'variant'
> {
  children: ReactNode;
  onPress?: PressableProps['onPress'];
  size?: TextButtonSize;
  variant?: TextButtonVariant;
  isDisabled?: boolean;
  className?: string;
}
