import { HStack, Text, TextSkeleton } from '@src/shared/ui';
import type { ReactNode } from 'react';

interface CategoryHeaderPillProps {
  label: string;
  color: string;
  children?: ReactNode;
}

export function CategoryHeaderPill({ label, color, children }: CategoryHeaderPillProps) {
  return (
    <HStack className="self-start items-center gap-1 rounded-lg bg-gray-2 px-2.5 py-1">
      <Text size="b4" weight="semibold" style={{ color }}>
        {label}
      </Text>
      {children}
    </HStack>
  );
}

CategoryHeaderPill.Loading = function Loading() {
  return (
    <HStack className="self-start items-center gap-1 rounded-lg bg-gray-2 px-2.5 py-1">
      <TextSkeleton size="b4" className="w-12" />
    </HStack>
  );
};
