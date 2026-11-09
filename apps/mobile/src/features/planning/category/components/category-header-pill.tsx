import { Text, TextSkeleton } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { Chip } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';

/** 섹션 머리 알약은 가로 10·세로 4(높이 27). md는 세로가 같고 가로가 12라 가로만 덮는다 */
const CATEGORY_HEADER_PILL_CLASS_NAME = 'px-2.5';

interface CategoryHeaderPillProps extends Omit<ComponentProps<typeof Chip>, 'children' | 'color'> {
  label: string;
  /** 카테고리 색(글자색) */
  color: string;
  children?: ReactNode;
}

export function CategoryHeaderPill({
  label,
  color,
  children,
  className,
  ...props
}: CategoryHeaderPillProps) {
  return (
    <Chip
      size="md"
      variant="secondary"
      className={cn(CATEGORY_HEADER_PILL_CLASS_NAME, className ?? 'self-start')}
      {...props}
    >
      <Text size="b4" weight="semibold" style={{ color }}>
        {label}
      </Text>
      {children}
    </Chip>
  );
}

CategoryHeaderPill.Loading = function Loading() {
  return (
    <Chip
      size="md"
      variant="secondary"
      pointerEvents="none"
      className={cn(CATEGORY_HEADER_PILL_CLASS_NAME, 'self-start')}
    >
      <TextSkeleton size="b4" className="w-12" />
    </Chip>
  );
};
