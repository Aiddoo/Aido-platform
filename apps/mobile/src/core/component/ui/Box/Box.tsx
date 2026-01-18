import { View } from 'react-native';
import type { BoxProps } from './Box.types';

export function Box({ className, style, children, ...props }: BoxProps) {
  return (
    <View className={className} style={style} {...props}>
      {children}
    </View>
  );
}
