import type { ComponentProps } from 'react';
import { View } from 'react-native';

export interface AspectRatioProps extends ComponentProps<typeof View> {
  /** 가로 ÷ 세로. 16:9면 `16 / 9` */
  ratio: number;
}

export function AspectRatio({ ratio, style, children, ...props }: AspectRatioProps) {
  return (
    <View style={[{ width: '100%', aspectRatio: ratio }, style]} {...props}>
      {children}
    </View>
  );
}
