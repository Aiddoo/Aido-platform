import { formatMonthDay, isDateToday } from '@src/shared/utils/date';

interface FormatTodoDateLabelParams {
  startDate: Date;
  scheduledTime: string | null | undefined;
  isAllDay: boolean;
  isRecurring?: boolean;
  repeatEndDate?: Date | null;
}

export const formatTodoDateLabel = ({
  startDate,
  scheduledTime,
  isAllDay,
  isRecurring,
  repeatEndDate,
}: FormatTodoDateLabelParams): string => {
  let label = isDateToday(startDate) ? '오늘' : formatMonthDay(startDate);

  if (isRecurring && repeatEndDate) {
    const endLabel = formatMonthDay(repeatEndDate);
    label += ` - ${endLabel}`;
  }

  if (!isAllDay && scheduledTime) {
    label += ` ${scheduledTime}`;
  }

  return label;
};
