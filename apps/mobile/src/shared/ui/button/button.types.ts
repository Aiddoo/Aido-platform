import type { Button } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';
import type { PressableProps } from 'react-native';

type ButtonSize = 'small' | 'medium' | 'large' | 'xlarge';
type ButtonVariant = 'fill' | 'weak';
type ButtonColor = 'primary' | 'danger' | 'dark';
type ButtonDisplay = 'inline' | 'block' | 'full';
type ButtonRadius = 'sm' | 'md' | 'lg' | 'full';

export interface ButtonProps extends Omit<
  ComponentProps<typeof Button>,
  'children' | 'onPress' | 'variant' | 'size' | 'isIconOnly' | 'feedbackVariant' | 'animation'
> {
  children: ReactNode;
  onPress?: PressableProps['onPress'];
  size?: ButtonSize;
  variant?: ButtonVariant;
  color?: ButtonColor;
  display?: ButtonDisplay;
  radius?: ButtonRadius;
  isLoading?: boolean;
}
