import { HStack } from '@src/shared/ui/HStack/HStack';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { getWeekDates, getWeekStart } from '@src/shared/utils/date';
import { CalendarDateCell } from './CalendarDateCell';
import { CalendarWeekdayHeader } from './CalendarWeekdayHeader';

interface CalendarWeekViewProps {
  displayDate: Date;
  value: Date;
  onChange: (date: Date) => void;
}

export const CalendarWeekView = ({ displayDate, value, onChange }: CalendarWeekViewProps) => {
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
          />
        ))}
      </HStack>
    </VStack>
  );
};
