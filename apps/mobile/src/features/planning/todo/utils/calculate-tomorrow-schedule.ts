import { isBeforeDay } from '@src/features/planning/todo/utils/calendar-date';
import type { Instant } from '@src/shared/date/instant';
import dayjs from 'dayjs';

interface TomorrowSchedule {
  startDate: Date;
  endDate: Instant | null;
}

export const calculateTomorrowSchedule = (
  endDate: Instant | null,
  today: Date,
  timeZone: string,
): TomorrowSchedule => {
  const tomorrow = dayjs(today).startOf('day').add(1, 'day').toDate();
  const isEndDateExpired = endDate != null && isBeforeDay(endDate, tomorrow, timeZone);

  return {
    startDate: tomorrow,
    endDate: isEndDateExpired ? null : endDate,
  };
};
