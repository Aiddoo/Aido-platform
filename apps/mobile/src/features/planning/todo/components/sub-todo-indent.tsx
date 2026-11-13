import { VStack } from '@src/shared/ui';
import type { ReactNode } from 'react';

export function SubTodoIndent({ children }: { children: ReactNode }) {
  return (
    <VStack className="ml-8 border-l border-gray-2 pl-4" gap={0}>
      {children}
    </VStack>
  );
}
