import { VStack } from '@src/shared/ui';
import type { ReactNode } from 'react';

export function SubTodoIndent({ children }: { children: ReactNode }) {
  return (
    <VStack className="ml-8 pl-4 border-l border-gray-2" gap={0}>
      {children}
    </VStack>
  );
}
