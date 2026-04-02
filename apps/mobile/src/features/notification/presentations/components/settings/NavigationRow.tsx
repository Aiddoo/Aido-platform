import { ArrowRightIcon, HStack, Text } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { PressableFeedback } from 'heroui-native';

interface NavigationRowProps {
  label: string;
  summary: string;
  summaryEnabled?: boolean;
  onPress: () => void;
  isDisabled?: boolean;
}

export function NavigationRow({
  label,
  summary,
  summaryEnabled,
  onPress,
  isDisabled,
}: NavigationRowProps) {
  return (
    <PressableFeedback onPress={onPress} isDisabled={isDisabled} className="rounded-lg">
      <PressableFeedback.Highlight className="rounded-lg" />
      <HStack
        justify="between"
        align="center"
        className={cn('py-2', isDisabled && 'opacity-40')}
        gap={20}
      >
        <Text size="b2" numberOfLines={1} className="flex-1 text-gray-9">
          {label}
        </Text>
        <HStack gap={8} align="center" className="shrink-0">
          <Text
            size="b2"
            numberOfLines={1}
            className={summaryEnabled ? 'text-main' : 'text-gray-5'}
          >
            {summary}
          </Text>
          <ArrowRightIcon colorClassName="text-gray-6" />
        </HStack>
      </HStack>
    </PressableFeedback>
  );
}
