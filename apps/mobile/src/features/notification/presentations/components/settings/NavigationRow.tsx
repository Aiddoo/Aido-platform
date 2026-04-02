import { ArrowRightIcon, HStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { Description, Label, PressableFeedback } from 'heroui-native';

interface NavigationRowProps {
  label: string;
  summary: string;
  onPress: () => void;
  isDisabled?: boolean;
}

export function NavigationRow({ label, summary, onPress, isDisabled }: NavigationRowProps) {
  return (
    <PressableFeedback onPress={onPress} isDisabled={isDisabled} className="rounded-lg">
      <PressableFeedback.Highlight className="rounded-lg" />
      <HStack justify="between" align="center" className={cn(isDisabled && 'opacity-40')} gap={20}>
        <Label>{label}</Label>
        <HStack gap={8} align="center">
          <Description>{summary}</Description>
          <ArrowRightIcon colorClassName="text-gray-6" />
        </HStack>
      </HStack>
    </PressableFeedback>
  );
}
