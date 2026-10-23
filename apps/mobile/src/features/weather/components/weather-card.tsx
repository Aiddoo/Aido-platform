import { VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import type { ComponentProps } from 'react';

import { useTimePalette } from '../hooks/use-time-palette';

export function WeatherCard({ className, style, ...props }: ComponentProps<typeof VStack>) {
  const palette = useTimePalette();

  return (
    <VStack
      mx={20}
      py={16}
      px={16}
      mb={12}
      className={cn('rounded-2xl overflow-hidden', className)}
      style={[{ backgroundColor: palette.glassCard }, style]}
      {...props}
    />
  );
}
