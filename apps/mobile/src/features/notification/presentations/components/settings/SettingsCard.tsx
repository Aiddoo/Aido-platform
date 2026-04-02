import { VStack } from '@src/shared/ui';
import type { PropsWithChildren } from 'react';

export function SettingsCard({ children }: PropsWithChildren) {
  return (
    <VStack p={16} gap={12} className="bg-white rounded-2xl">
      {children}
    </VStack>
  );
}
