import { HStack } from '@src/shared/ui/HStack/HStack';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { formatDate, getWeekDates, getWeekStart } from '@src/shared/utils/date';
import type { CompletionsByDate } from '../../queries/use-get-daily-completions-query-options';
import { CalendarDateCell } from './CalendarDateCell';
import { CalendarWeekdayHeader } from './CalendarWeekdayHeader';

interface CalendarWeekViewProps {
  value: Date;
  onChange: (date: Date) => void;
  completions: CompletionsByDate;
}

export const CalendarWeekView = ({ value, onChange, completions }: CalendarWeekViewProps) => {
  const weekStart = getWeekStart(value);
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
            onPress={onChange}
            completion={completions[formatDate(date)]}
          />
        ))}
      </HStack>
    </VStack>
  );
};
