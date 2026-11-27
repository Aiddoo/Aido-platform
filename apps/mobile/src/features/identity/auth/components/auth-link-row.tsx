import { HStack } from '@src/shared/ui';
import { Separator } from 'heroui-native';
import type { ReactNode } from 'react';

export function AuthLinkRow({ children: [first, second] }: { children: [ReactNode, ReactNode] }) {
  return (
    <HStack justify="center" align="center" gap={8}>
      {first}
      <Separator orientation="vertical" className="h-3 bg-gray-6" />
      {second}
    </HStack>
  );
}
