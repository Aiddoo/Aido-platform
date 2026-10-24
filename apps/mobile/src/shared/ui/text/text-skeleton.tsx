import { useFontScale } from '@src/shared/providers/font-scale-provider';
import { cn } from '@src/shared/utils/cn';
import { Skeleton } from 'heroui-native';
import { View } from 'react-native';
import { useResolveClassNames } from 'uniwind';

import type { TextSize } from './text.types';
import { textSizeClasses } from './text.variants';

export interface TextSkeletonProps {
  size?: TextSize;
  className?: string;
  color?: string;
}

export function TextSkeleton({ size = 'b3', className, color }: TextSkeletonProps) {
  const { resolveSize } = useFontScale();
  const { fontSize, lineHeight } = useResolveClassNames(textSizeClasses[resolveSize(size)]);

  return (
    <View className={cn('justify-center', className)} style={{ height: lineHeight }}>
      <Skeleton
        className="rounded"
        style={color == null ? { height: fontSize } : { height: fontSize, backgroundColor: color }}
      />
    </View>
  );
}
