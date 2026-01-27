import { Box } from '@src/shared/ui/Box/Box';
import { Text } from '@src/shared/ui/Text/Text';
import type { TextTone } from '@src/shared/ui/Text/Text.types';
import { cn } from '@src/shared/utils/cn';
import { isDateToday, isSameDay, isSameMonth, isSaturday, isSunday } from '@src/shared/utils/date';
import { PressableFeedback } from 'heroui-native';

interface CalendarDateCellProps {
  date: Date;
  selectedDate: Date;
  displayDate: Date;
  onPress: (date: Date) => void;
}

export const CalendarDateCell = ({
  date,
  selectedDate,
  displayDate,
  onPress,
}: CalendarDateCellProps) => {
  const dayOfMonth = date.getDate();
  const isSelected = isSameDay(date, selectedDate);
  const isCurrentMonth = isSameMonth(date, displayDate);
  const isToday = isDateToday(date);

  const getDayTone = (): TextTone => {
    if (isSelected) return 'white';
    if (isSunday(date)) return 'danger';
    if (isSaturday(date)) return 'info';
    if (isToday) return 'brand';
    return 'neutral';
  };

  return (
    <PressableFeedback onPress={() => onPress(date)} className="flex-1 items-center py-2">
      <Box
        className={cn(
          'size-8 items-center justify-center rounded-full',
          isSelected && 'bg-main',
          isToday && !isSelected && 'bg-main/10',
        )}
      >
        <Text size="b4" weight="medium" tone={getDayTone()} shade={isCurrentMonth ? undefined : 4}>
          {dayOfMonth}
        </Text>
      </Box>
    </PressableFeedback>
  );
};
