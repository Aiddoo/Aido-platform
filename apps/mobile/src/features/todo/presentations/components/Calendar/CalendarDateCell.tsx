import { Box } from '@src/shared/ui/Box/Box';
import { FishIcon } from '@src/shared/ui/Icon/icons';
import { Text } from '@src/shared/ui/Text/Text';
import type { TextTone } from '@src/shared/ui/Text/Text.types';
import { cn } from '@src/shared/utils/cn';
import { isDateToday, isSameDay, isSameMonth, isSaturday, isSunday } from '@src/shared/utils/date';
import { PressableFeedback } from 'heroui-native';
import type { DailyCompletionSummary } from '../../../models/todo.model';

interface CalendarDateCellProps {
  date: Date;
  selectedDate: Date;
  displayDate: Date;
  onPress: (date: Date) => void;
  completion?: DailyCompletionSummary;
}

export const CalendarDateCell = ({
  date,
  selectedDate,
  displayDate,
  onPress,
  completion,
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

  const hasCompletion = completion != null;
  const isAllComplete = completion?.isComplete === true;
  const showCompletedCount = hasCompletion && completion.completedTodos > 0;

  return (
    <PressableFeedback onPress={() => onPress(date)} className="flex-1 items-center py-1">
      <Box
        className={cn(
          'size-8 items-center justify-center overflow-hidden rounded-2xl',
          isSelected && 'bg-main',
          isToday && !isSelected && 'bg-main/10',
        )}
      >
        {isAllComplete ? (
          <FishIcon width={20} height={13} colorClassName="text-fish" />
        ) : (
          <Text
            size="b4"
            weight="medium"
            tone={getDayTone()}
            shade={isCurrentMonth ? undefined : 4}
          >
            {dayOfMonth}
          </Text>
        )}
      </Box>
      <Text
        size="e2"
        weight="medium"
        className={cn('mt-0.5 text-main/80', !showCompletedCount && 'opacity-0')}
      >
        {showCompletedCount ? `+${completion.completedTodos}` : ' '}
      </Text>
    </PressableFeedback>
  );
};
