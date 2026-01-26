import { HStack } from '@src/shared/ui/HStack/HStack';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { getMonthWeeks } from '@src/shared/utils/date';
import { CalendarDateCell } from './CalendarDateCell';
import { CalendarWeekdayHeader } from './CalendarWeekdayHeader';

interface CalendarMonthViewProps {
  displayDate: Date;
  value: Date;
  onChange: (date: Date) => void;
}

export const CalendarMonthView = ({ displayDate, value, onChange }: CalendarMonthViewProps) => {
  const weeks = getMonthWeeks(displayDate);

  return (
    <VStack>
      <CalendarWeekdayHeader />
      {weeks.map((week, weekIndex) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: 주 순서가 변경되지 않음
        <HStack key={weekIndex} px={8}>
          {week.map((date) => (
            <CalendarDateCell
              key={date.toISOString()}
              date={date}
              selectedDate={value}
              displayDate={displayDate}
              onPress={onChange}
            />
          ))}
        </HStack>
      ))}
    </VStack>
  );
};
