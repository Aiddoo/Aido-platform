import { useFontScale } from '@src/shared/providers/font-scale-provider';
import { cn } from '@src/shared/utils/cn';
import { Skeleton } from 'heroui-native';
import type { ComponentProps } from 'react';
import { useResolveClassNames } from 'uniwind';

import { Box } from '../box/box';
import type { TextSize } from './text.types';
import { TEXT_SIZE_CLASSES } from './text.variants';

/** `className`은 글줄 칸(폭·바깥 배치)에 주고, 나머지 원본 props는 막대 `Skeleton`에 넘긴다 */
export interface TextSkeletonProps extends Omit<
  ComponentProps<typeof Skeleton>,
  'children' | 'style'
> {
  size?: TextSize;
  color?: string;
}

export function TextSkeleton({ size = 'b3', className, color, ...props }: TextSkeletonProps) {
  const { resolveSize } = useFontScale();
  const { fontSize, lineHeight } = useResolveClassNames(TEXT_SIZE_CLASSES[resolveSize(size)]);

  return (
    <Box className={cn('justify-center', className)} style={{ height: lineHeight }}>
      <Skeleton
        {...props}
        className="rounded dark:bg-gray-2"
        style={color == null ? { height: fontSize } : { height: fontSize, backgroundColor: color }}
      />
    </Box>
  );
}
