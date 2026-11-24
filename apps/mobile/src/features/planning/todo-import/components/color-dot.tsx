import { Box } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import type { ComponentProps } from 'react';

interface ColorDotProps extends Omit<ComponentProps<typeof Box>, 'children'> {
  /** 아이두 카테고리 색 */
  color: string;
}

/** 넣을 아이두 카테고리의 색 점 */
export function ColorDot({ color, className, style, ...props }: ColorDotProps) {
  return (
    <Box
      className={cn('size-2.5 rounded-full', className)}
      style={[{ backgroundColor: color }, style]}
      {...props}
    />
  );
}
