import { cn } from '@src/shared/utils/cn';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

export interface AspectRatioProps extends ComponentProps<typeof View> {
  /** 가로 ÷ 세로. 16:9면 `16 / 9` */
  ratio: number;
}

export function AspectRatio({ ratio, className, style, children, ...props }: AspectRatioProps) {
  return (
    <View className={cn('w-full', className)} style={[{ aspectRatio: ratio }, style]} {...props}>
      {children}
    </View>
  );
}
