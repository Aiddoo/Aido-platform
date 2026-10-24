import { ArrowRightIcon, HStack, Text } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { PressableFeedback } from 'heroui-native';
import type { ComponentProps } from 'react';

interface NavigationRowProps extends Omit<ComponentProps<typeof PressableFeedback>, 'children'> {
  label: string;
  summary: string;
  summaryEnabled?: boolean;
}

export function NavigationRow({
  label,
  summary,
  summaryEnabled,
  isDisabled,
  className,
  ...pressableProps
}: NavigationRowProps) {
  return (
    <PressableFeedback
      isDisabled={isDisabled}
      className={cn('rounded-lg', className)}
      {...pressableProps}
    >
      <PressableFeedback.Highlight className="rounded-lg" />
      <HStack
        justify="between"
        align="center"
        className={cn('py-2', isDisabled && 'opacity-40')}
        gap={20}
      >
        <Text size="b2" shade={8}>
          {label}
        </Text>
        <HStack gap={8} align="center">
          <Text size="b2" className={summaryEnabled ? 'text-main' : 'text-gray-5'}>
            {summary}
          </Text>
          <ArrowRightIcon colorClassName="text-gray-6" />
        </HStack>
      </HStack>
    </PressableFeedback>
  );
}
