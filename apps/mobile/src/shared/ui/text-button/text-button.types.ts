import type { LinkButton } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';

type TextButtonSize = 'xsmall' | 'small' | 'medium' | 'large' | 'xlarge';
type TextButtonVariant = 'clear' | 'underline' | 'arrow';

export interface TextButtonProps extends Omit<
  ComponentProps<typeof LinkButton>,
  'children' | 'size' | 'variant'
> {
  children: ReactNode;
  size?: TextButtonSize;
  variant?: TextButtonVariant;
}
