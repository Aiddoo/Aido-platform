import { formatDateLabel } from '@src/shared/date/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useToday } from '@src/shared/hooks/use-today';
import { Box, Text } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { PressableFeedback } from 'heroui-native';
import { memo, type ReactNode } from 'react';

import { useFeedDate } from '../../hooks/use-feed-params';
import { DAY_TYPE_TONE, getMonthViewDayType, isTodayHighlighted } from '../../utils/calendar-day';
import { isSameDay } from '../../utils/calendar-day-comparison';

export const CALENDAR_DATE_CELL_HEIGHT = 56;

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
  const [value, onChange] = useFeedDate();
  const today = useToday();
  const dateFormatContext = useDateFormatContext();
  const { timeZone } = dateFormatContext;
  const isSelected = isSameDay(date, value, timeZone);
  const dayType = getMonthViewDayType({ date, isSelected, today, timeZone });
  const highlightToday = isTodayHighlighted({ date, isSelected, today, timeZone });

  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={formatDateLabel(date, 'fullDate', dateFormatContext)}
      accessibilityState={{ selected: isSelected }}
      onPress={() => onChange(date)}
      style={{ height: CALENDAR_DATE_CELL_HEIGHT }}
      className={cn('flex-1 items-center justify-between py-1', className)}
    >
      <Box
        className={cn(
          'size-7.5 items-center justify-center overflow-hidden rounded-2xl',
          isSelected && 'bg-main',
          highlightToday && 'bg-main/10 dark:bg-main/20',
        )}
      >
        <Text size="b4" weight="medium" tone={DAY_TYPE_TONE[dayType]} shade={7}>
          {date.getDate()}
        </Text>
      </Box>
      <Box className="h-3 items-center justify-center">{children}</Box>
    </PressableFeedback>
  );
});
