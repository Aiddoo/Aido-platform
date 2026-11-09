import type { ReactNode } from 'react';
import type { ViewProps } from 'react-native';

import type { ButtonProps } from '../button/button.types';

export interface ResultProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  button?: ReactNode;
  className?: string;
  testID?: ViewProps['testID'];
}

export interface ResultButtonProps extends Omit<ButtonProps, 'size' | 'display'> {}
