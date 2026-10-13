import { ArrowRightIcon, HStack, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { formatReminderTime, type TimeFormat } from '@src/shared/utils/time';
import { PressableFeedback } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';

interface SettingsTimeRowProps extends Pick<
  ComponentProps<typeof PressableFeedback>,
  'onPress' | 'isDisabled'
> {
  label: string;
  description: string;
  hour: number;
  minute: number;
  timeFormat: TimeFormat;
  accessory?: ReactNode;
}

export function SettingsTimeRow({
  label,
  description,
  hour,
  minute,
  timeFormat,
  isDisabled,
  accessory,
  onPress,
}: SettingsTimeRowProps) {
  return (
    <PressableFeedback onPress={onPress} isDisabled={isDisabled} className="rounded-lg">
      <PressableFeedback.Highlight className="rounded-lg" />
      <HStack justify="between" align="center" className={cn(isDisabled && 'opacity-40')} gap={20}>
        <VStack className="flex-1">
          <HStack gap={8} align="center">
            <Text size="b2" shade={8}>
              {label}
            </Text>
            {accessory}
            <Text size="b2" className="text-main break-keep">
              {formatReminderTime(hour, minute, timeFormat)}
            </Text>
          </HStack>
          <Text size="b3" shade={6}>
            {description}
          </Text>
        </VStack>
        <ArrowRightIcon colorClassName="text-gray-6" />
      </HStack>
    </PressableFeedback>
  );
}
