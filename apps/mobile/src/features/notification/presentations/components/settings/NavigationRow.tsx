import { ArrowRightIcon, HStack, Text } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { Label, PressableFeedback } from 'heroui-native';

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
        className={cn('px-4 py-2', isDisabled && 'opacity-40')}
        gap={20}
      >
        <Label>{label}</Label>
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
