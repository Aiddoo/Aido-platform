import { Flex, Text } from '@src/shared/ui';
import type { ReactNode } from 'react';

interface CategoryHeaderPillProps {
  label: string;
  color: string;
  children?: ReactNode;
}

export function CategoryHeaderPill({ label, color, children }: CategoryHeaderPillProps) {
  return (
    <Flex className="self-start flex-row items-center gap-1 rounded-lg bg-gray-2 px-2.5 py-1">
      <Text size="b4" weight="semibold" style={{ color }}>
        {label}
      </Text>
      {children}
    </Flex>
  );
}
