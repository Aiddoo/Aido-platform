import { Box, FishIcon, HStack, Text } from '@src/shared/ui';
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
  const colors = completion?.categoryColors ?? [];

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
      <Box className="h-3 items-center justify-center">
        {isAllComplete ? (
          <FishIcon width={16} height={12} colorClassName="text-fish" />
        ) : hasTodos ? (
          <CategoryIndicator colors={colors} />
        ) : null}
      </Box>
    </PressableFeedback>
  );
};

interface CategoryIndicatorProps {
  colors: string[];
}

const CategoryIndicator = ({ colors }: CategoryIndicatorProps) => {
  if (colors.length <= 1) {
    return (
      <Box style={{ backgroundColor: colors[0] ?? '#9CA3AF' }} className="size-1.5 rounded-2xl" />
    );
  }

  return (
    <HStack className="h-1.5 w-4 overflow-hidden rounded-2xl">
      {colors.slice(0, 3).map((color) => (
        <Box key={color} style={{ backgroundColor: color }} className="flex-1" />
      ))}
    </HStack>
  );
};
