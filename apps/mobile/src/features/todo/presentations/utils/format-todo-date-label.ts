import { formatMonthDay, isDateToday } from '@src/shared/utils/date';

interface FormatTodoDateLabelParams {
  startDate: Date;
  scheduledTime: string | null | undefined;
  isAllDay: boolean;
}

export const formatTodoDateLabel = ({
  startDate,
  scheduledTime,
  isAllDay,
}: FormatTodoDateLabelParams): string => {
  let label = isDateToday(startDate) ? '오늘' : formatMonthDay(startDate);

  if (!isAllDay && scheduledTime) {
    label += ` ${scheduledTime}`;
  }

  return label;
};
