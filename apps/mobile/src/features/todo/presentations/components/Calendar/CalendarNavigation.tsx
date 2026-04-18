import { ArrowLeftIcon, ArrowRightIcon, HStack } from '@src/shared/ui';
import { PressableFeedback } from 'heroui-native';

interface CalendarNavigationProps {
  onPrevious: () => void;
  onNext: () => void;
}

export const CalendarNavigation = ({ onPrevious, onNext }: CalendarNavigationProps) => {
  return (
    <HStack gap={4}>
      <PressableFeedback onPress={onPrevious} className="p-1">
        <ArrowLeftIcon width={20} height={20} colorClassName="text-gray-6" />
      </PressableFeedback>
      <PressableFeedback onPress={onNext} className="p-1">
        <ArrowRightIcon width={20} height={20} colorClassName="text-gray-6" />
      </PressableFeedback>
    </HStack>
  );
};
