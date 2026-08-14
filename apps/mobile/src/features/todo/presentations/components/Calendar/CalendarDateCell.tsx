import { useFeedDate } from '@src/features/todo/presentations/hooks/use-feed-date';
import { Box, Text } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { isSameDay } from '@src/shared/utils/date';
import { PressableFeedback } from 'heroui-native';
import { memo, type ReactNode } from 'react';

import { DAY_TYPE_TONE, getMonthViewDayStyle, isTodayHighlighted } from '../../utils/calendar-day';

interface CalendarDateCellProps {
  date: Date;
  children?: ReactNode;
  className?: string;
}

export const CalendarDateCell = memo(({ date, children, className }: CalendarDateCellProps) => {
  const [value, onChange] = useFeedDate();
  const isSelected = isSameDay(date, value);
  const dayStyle = getMonthViewDayStyle({ date, isSelected });
  const highlightToday = isTodayHighlighted({ date, isSelected });

  return (
    <PressableFeedback
      onPress={() => onChange(date)}
      className={cn('h-[56px] flex-1 items-center justify-between py-1', className)}
    >
      <Box
        className={cn(
          'size-7.5 items-center justify-center overflow-hidden rounded-2xl',
          isSelected && 'bg-main',
          highlightToday && 'bg-main/10 dark:bg-main/20',
        )}
      >
        <Text size="b4" weight="medium" tone={DAY_TYPE_TONE[dayStyle]} shade={7}>
          {date.getDate()}
        </Text>
      </Box>
      <Box className="h-3 items-center justify-center">{children}</Box>
    </PressableFeedback>
  );
});
