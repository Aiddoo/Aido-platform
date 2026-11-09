import { Text, TextSkeleton } from '@src/shared/ui';
import { Chip } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';

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
    <Chip size="sm" variant="secondary" className={className ?? 'self-start'} {...props}>
      <Text size="b4" weight="semibold" style={{ color }}>
        {label}
      </Text>
      {children}
    </Chip>
  );
}

CategoryHeaderPill.Loading = function Loading() {
  return (
    <Chip size="sm" variant="secondary" pointerEvents="none" className="self-start">
      <TextSkeleton size="b4" className="w-12" />
    </Chip>
  );
};
