import { VStack } from '@src/shared/ui';
import type { ReactNode } from 'react';

import { useTimePalette } from '../hooks/use-time-palette';

interface WeatherCardProps {
  gap?: number;
  children: ReactNode;
}

export function WeatherCard({ gap, children }: WeatherCardProps) {
  const palette = useTimePalette();

  return (
    <VStack
      mx={20}
      py={16}
      px={16}
      mb={12}
      gap={gap}
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: palette.glassCard }}
    >
      {children}
    </VStack>
  );
}
