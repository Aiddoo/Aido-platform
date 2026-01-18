import type { ViewProps } from 'react-native';

export interface BoxProps extends Omit<ViewProps, 'style'> {
  className?: string;
  style?: ViewProps['style'];
  children?: React.ReactNode;
}
