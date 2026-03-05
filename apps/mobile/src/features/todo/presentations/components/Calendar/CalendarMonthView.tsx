import { Box } from '@src/shared/ui/Box/Box';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { formatDate, getMonthWeeks, isSameMonth } from '@src/shared/utils/date';
import type { CompletionsByDate } from '../../queries/use-get-daily-completions-query-options';
import { CalendarDateCell } from './CalendarDateCell';
import { CalendarWeekdayHeader } from './CalendarWeekdayHeader';

interface CalendarMonthViewProps {
  value: Date;
  onChange: (date: Date) => void;
  completions: CompletionsByDate;
}

export const CalendarMonthView = ({ value, onChange, completions }: CalendarMonthViewProps) => {
  const weeks = getMonthWeeks(value);

  return (
    <VStack>
      <CalendarWeekdayHeader />
      {weeks.map((week, weekIndex) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: 주 순서가 변경되지 않음
        <HStack key={weekIndex} px={8}>
          {week.map((date) =>
            isSameMonth(date, value) ? (
              <CalendarDateCell
                key={date.toISOString()}
                date={date}
                selectedDate={value}
                onPress={onChange}
                completion={completions[formatDate(date)]}
              />
            ) : (
              <Box key={date.toISOString()} className="h-[56px] flex-1" />
            ),
          )}
        </HStack>
      ))}
    </VStack>
  );
};
