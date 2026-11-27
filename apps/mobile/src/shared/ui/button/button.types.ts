import type { Button } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';
import type { PressableProps } from 'react-native';

type ButtonSize = 'small' | 'medium' | 'large' | 'xlarge';
type ButtonVariant = 'fill' | 'weak';
type ButtonColor = 'primary' | 'danger' | 'dark';
type ButtonDisplay = 'inline' | 'block' | 'full';
type ButtonRadius = 'sm' | 'md' | 'lg' | 'full';

// heroui는 Reanimated `AnimatedProps`라 onPress에 SharedValue까지 받는다. 누름 처리는 RN Pressable 원본 모양으로 받는다
export interface ButtonProps
  extends
    Omit<
      ComponentProps<typeof Button>,
      'children' | 'onPress' | 'variant' | 'size' | 'isIconOnly' | 'feedbackVariant' | 'animation'
    >,
    Pick<PressableProps, 'onPress'> {
  children: ReactNode;
  size?: ButtonSize;
  variant?: ButtonVariant;
  color?: ButtonColor;
  display?: ButtonDisplay;
  radius?: ButtonRadius;
  isLoading?: boolean;
}
