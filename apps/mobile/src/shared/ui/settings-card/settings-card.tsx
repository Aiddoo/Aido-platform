import { cn } from '@src/shared/utils/cn';
import { ControlField, Skeleton } from 'heroui-native';
import type { ComponentProps, PropsWithChildren } from 'react';

import { Box } from '../box';
import { HStack } from '../h-stack';
import { Text, TextSkeleton } from '../text';
import { VStack } from '../v-stack';

export interface SettingsCardProps extends PropsWithChildren {
  className?: string;
}

export function SettingsCard({ children, className }: SettingsCardProps) {
  return (
    <VStack p={16} gap={12} className={cn('bg-white rounded-2xl', className)}>
      {children}
    </VStack>
  );
}

export interface SettingsCardToggleProps extends Omit<
  ComponentProps<typeof ControlField>,
  'children'
> {
  label: string;
  description?: string;
}

SettingsCard.Toggle = function Toggle({ label, description, ...props }: SettingsCardToggleProps) {
  return (
    <ControlField {...props}>
      <Box className="flex-1">
        <Text size="b2" shade={8}>
          {label}
        </Text>
        {description != null && (
          <Text size="b3" shade={6}>
            {description}
          </Text>
        )}
      </Box>
      <ControlField.Indicator />
    </ControlField>
  );
};

export interface SettingsCardToggleSkeletonProps {
  hasDescription?: boolean;
}

SettingsCard.ToggleSkeleton = function ToggleSkeleton({
  hasDescription = false,
}: SettingsCardToggleSkeletonProps) {
  return (
    <HStack align="center" gap={12}>
      <VStack flex={1}>
        <TextSkeleton size="b2" className="w-24" />
        {hasDescription && <TextSkeleton size="b3" className="w-48" />}
      </VStack>
      <Skeleton className="h-6 w-12 rounded-full" />
    </HStack>
  );
};
