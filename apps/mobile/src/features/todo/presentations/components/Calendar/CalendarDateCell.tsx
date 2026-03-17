import { Box, FishIcon, Text } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { isSameDay } from '@src/shared/utils/date';
import { PressableFeedback } from 'heroui-native';
import type { DailyCompletionSummary } from '../../../models/todo.model';
import { DAY_TYPE_TONE, getMonthViewDayStyle, isTodayHighlighted } from '../../utils/calendar-day';

interface CalendarDateCellProps {
  date: Date;
  selectedDate: Date;
  onPress: (date: Date) => void;
  completion?: DailyCompletionSummary;
}

export const CalendarDateCell = ({
  date,
  selectedDate,
  onPress,
  completion,
}: CalendarDateCellProps) => {
  const dayOfMonth = date.getDate();
  const isSelected = isSameDay(date, selectedDate);
  const dayStyle = getMonthViewDayStyle({ date, isSelected });
  const highlightToday = isTodayHighlighted({ date, isSelected });

  const hasTodos = !!completion?.totalTodos;
  const isAllComplete = !!completion?.isComplete;

  return (
    <PressableFeedback
      onPress={() => onPress(date)}
      className="h-[56px] flex-1 items-center justify-between py-1"
    >
      <Box
        className={cn(
          'size-7.5 items-center justify-center overflow-hidden rounded-2xl',
          isSelected && 'bg-main',
          highlightToday && 'bg-main/10 dark:bg-main/20',
        )}
      >
        <Text size="b4" weight="medium" tone={DAY_TYPE_TONE[dayStyle]} shade={7}>
          {dayOfMonth}
        </Text>
      </Box>
      {isAllComplete ? (
        <FishIcon width={16} height={12} colorClassName="text-fish" />
      ) : hasTodos ? (
        <Box className="size-1.5 rounded-2xl bg-gray-4" />
      ) : (
        <Box className="size-1.5" />
      )}
    </PressableFeedback>
  );
};
