import {
  formatDayOfMonth,
  formatMonthDay,
  isDateToday,
  isSameDay,
  isSameMonth,
} from '@src/shared/utils/date';

interface FormatTodoDateLabelParams {
  startDate: Date;
  endDate: Date | null;
  scheduledTime: string | null | undefined;
  isAllDay: boolean;
}

export const formatTodoDateLabel = ({
  startDate,
  endDate,
  scheduledTime,
  isAllDay,
}: FormatTodoDateLabelParams): string => {
  const start = isDateToday(startDate) ? '오늘' : formatMonthDay(startDate);

  let label = start;

  if (endDate && !isSameDay(startDate, endDate)) {
    const end = isSameMonth(startDate, endDate)
      ? formatDayOfMonth(endDate)
      : formatMonthDay(endDate);
    label += ` - ${end}`;
  }

  if (!isAllDay && scheduledTime) {
    label += ` ${scheduledTime}`;
  }

  return label;
};
