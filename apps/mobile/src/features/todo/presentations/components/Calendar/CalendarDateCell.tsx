import { Box } from '@src/shared/ui/Box/Box';
import { FishIcon } from '@src/shared/ui/Icon/icons';
import { Text } from '@src/shared/ui/Text/Text';
import type { TextTone } from '@src/shared/ui/Text/Text.types';
import { cn } from '@src/shared/utils/cn';
import { isDateToday, isSameDay, isSaturday, isSunday } from '@src/shared/utils/date';
import { PressableFeedback } from 'heroui-native';
import type { DailyCompletionSummary } from '../../../models/todo.model';

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
  const isToday = isDateToday(date);

  const getDayTone = (): TextTone => {
    if (isSelected) return 'white';
    if (isSunday(date)) return 'danger';
    if (isSaturday(date)) return 'info';
    if (isToday) return 'brand';
    return 'neutral';
  };

  const isAllComplete = !!completion?.isComplete;
  const showCompletedCount = !!completion?.completedTodos;

  return (
    <PressableFeedback onPress={() => onPress(date)} className="h-[56px] flex-1 items-center py-1">
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
          <Text size="b4" weight="medium" tone={getDayTone()}>
            {dayOfMonth}
          </Text>
        )}
      </Box>
      {showCompletedCount && (
        <Text size="e2" weight="medium" className="mt-0.5 text-main/80">
          +{completion.completedTodos}
        </Text>
      )}
    </PressableFeedback>
  );
};
