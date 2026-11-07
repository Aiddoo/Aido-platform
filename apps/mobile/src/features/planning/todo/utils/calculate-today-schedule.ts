import { isBeforeDay } from '@src/features/planning/todo/utils/calendar-date';
import type { Instant } from '@src/shared/date/instant';
import dayjs from 'dayjs';

interface TodaySchedule {
  startDate: Date;
  endDate: Instant | null;
}

export const calculateTodaySchedule = (
  endDate: Instant | null,
  today: Date,
  timeZone: string,
): TodaySchedule => {
  const todayStart = dayjs(today).startOf('day').toDate();
  const isEndDateExpired = endDate != null && isBeforeDay(endDate, todayStart, timeZone);

  return {
    startDate: todayStart,
    endDate: isEndDateExpired ? null : endDate,
  };
};
