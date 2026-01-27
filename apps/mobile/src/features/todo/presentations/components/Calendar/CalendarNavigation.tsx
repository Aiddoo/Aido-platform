import { HStack } from '@src/shared/ui/HStack/HStack';
import { ArrowLeftIcon, ArrowRightIcon } from '@src/shared/ui/Icon';
import {
  getNextMonth,
  getNextWeek,
  getPreviousMonth,
  getPreviousWeek,
} from '@src/shared/utils/date';
import { PressableFeedback } from 'heroui-native';
import { match } from 'ts-pattern';
import type { CalendarViewMode } from './calendar.types';

interface CalendarNavigationProps {
  viewMode: CalendarViewMode;
  value: Date;
  onChange: (date: Date) => void;
}

export const CalendarNavigation = ({ viewMode, value, onChange }: CalendarNavigationProps) => {
  const handlePrevious = () => {
    const newDate = match(viewMode)
      .with('week', () => getPreviousWeek(value))
      .with('month', () => getPreviousMonth(value))
      .exhaustive();
    onChange(newDate);
  };

  const handleNext = () => {
    const newDate = match(viewMode)
      .with('week', () => getNextWeek(value))
      .with('month', () => getNextMonth(value))
      .exhaustive();
    onChange(newDate);
  };

  return (
    <HStack gap={4}>
      <PressableFeedback onPress={handlePrevious} className="p-1">
        <ArrowLeftIcon width={20} height={20} colorClassName="accent-gray-6" />
      </PressableFeedback>
      <PressableFeedback onPress={handleNext} className="p-1">
        <ArrowRightIcon width={20} height={20} colorClassName="accent-gray-6" />
      </PressableFeedback>
    </HStack>
  );
};
