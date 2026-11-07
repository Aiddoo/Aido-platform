import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useToday } from '@src/shared/hooks/use-today';
import { Box, Text } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { PressableFeedback } from 'heroui-native';
import { memo, type ReactNode } from 'react';

import { useFeedDateParam } from '../../hooks/use-feed-params';
import { isSameDay } from '../../utils/calendar-date';
import { DAY_TYPE_TONE, getMonthViewDayStyle, isTodayHighlighted } from '../../utils/calendar-day';

interface CalendarDateCellProps {
  date: Date;
  children?: ReactNode;
  className?: string;
}

export const CalendarDateCell = memo(function CalendarDateCell({
  date,
  children,
  className,
}: CalendarDateCellProps) {
  const [value, onChange] = useFeedDateParam();
  const today = useToday();
  const { timeZone } = useDateFormatContext();
  const isSelected = isSameDay(date, value, timeZone);
  const dayStyle = getMonthViewDayStyle({ date, isSelected, today, timeZone });
  const highlightToday = isTodayHighlighted({ date, isSelected, today, timeZone });

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
