import { HStack } from '@src/shared/ui/HStack/HStack';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { formatDate, getWeekDates, getWeekStart } from '@src/shared/utils/date';
import type { DailyCompletionSummary } from '../../../models/todo.model';
import { CalendarDateCell } from './CalendarDateCell';
import { CalendarWeekdayHeader } from './CalendarWeekdayHeader';

interface CalendarWeekViewProps {
  displayDate: Date;
  value: Date;
  onChange: (date: Date) => void;
  completions: Record<string, DailyCompletionSummary>;
}

export const CalendarWeekView = ({
  displayDate,
  value,
  onChange,
  completions,
}: CalendarWeekViewProps) => {
  const weekStart = getWeekStart(displayDate);
  const dates = getWeekDates(weekStart);

  return (
    <VStack>
      <CalendarWeekdayHeader />

      <HStack px={8}>
        {dates.map((date) => (
          <CalendarDateCell
            key={date.toISOString()}
            date={date}
            selectedDate={value}
            displayDate={displayDate}
            onPress={onChange}
            completion={completions[formatDate(date)]}
          />
        ))}
      </HStack>
    </VStack>
  );
};
