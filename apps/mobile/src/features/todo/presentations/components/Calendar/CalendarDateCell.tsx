import { Box } from '@src/shared/ui/Box/Box';
import { FishIcon } from '@src/shared/ui/Icon/icons';
import { Text } from '@src/shared/ui/Text/Text';
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

  const isAllComplete = !!completion?.isComplete;
  const showCompletedCount = !!completion?.completedTodos;

  return (
    <PressableFeedback onPress={() => onPress(date)} className="h-[56px] flex-1 items-center py-1">
      <Box
        className={cn(
          'size-8 items-center justify-center overflow-hidden rounded-2xl',
          isSelected && 'bg-main',
          highlightToday && 'bg-main/10 dark:bg-main/20',
        )}
      >
        {isAllComplete ? (
          <FishIcon width={20} height={13} colorClassName="text-fish" />
        ) : (
          <Text size="b3" weight="medium" tone={DAY_TYPE_TONE[dayStyle]} shade={7}>
            {dayOfMonth}
          </Text>
        )}
      </Box>
      {showCompletedCount && (
        <Text size="e1" weight="medium" className="mt-0.5 text-main/80">
          +{completion.completedTodos}
        </Text>
      )}
    </PressableFeedback>
  );
};
