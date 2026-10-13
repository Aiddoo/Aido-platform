import type { ReactNode } from 'react';
import type { PressableProps } from 'react-native';

export type ButtonSize = 'small' | 'medium' | 'large' | 'xlarge';
export type ButtonVariant = 'fill' | 'weak';
export type ButtonColor = 'primary' | 'danger' | 'dark';
export type ButtonDisplay = 'inline' | 'block' | 'full';
export type ButtonRadius = 'sm' | 'md' | 'lg' | 'full';

export interface ButtonProps extends Omit<PressableProps, 'children'> {
  children: ReactNode;
  size?: ButtonSize;
  variant?: ButtonVariant;
  color?: ButtonColor;
  display?: ButtonDisplay;
  radius?: ButtonRadius;
  isLoading?: boolean;
  isDisabled?: boolean;
  className?: string;
}
