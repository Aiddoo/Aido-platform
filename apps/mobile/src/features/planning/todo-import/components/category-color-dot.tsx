import { Box } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import type { ComponentProps } from 'react';

interface CategoryColorDotProps extends Omit<ComponentProps<typeof Box>, 'children'> {
  /** 아이두 카테고리 색 */
  color: string;
}

/** 넣을 아이두 카테고리의 색 점 */
export function CategoryColorDot({ color, className, style, ...props }: CategoryColorDotProps) {
  return (
    <Box
      className={cn('size-2.5 rounded-full', className)}
      style={[{ backgroundColor: color }, style]}
      {...props}
    />
  );
}
