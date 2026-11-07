import type { Instant } from '@src/shared/date/instant';
import { startOfLocalDay } from '@src/shared/date/local-day';

import { isBeforeDay } from './calendar-day-comparison';

interface TodaySchedule {
  startDate: Date;
  endDate: Instant | null;
}

export function calculateTodaySchedule(
  endDate: Instant | null,
  today: Date,
  timeZone: string,
): TodaySchedule {
  const todayStart = startOfLocalDay(today, timeZone);
  const isEndDateExpired = endDate != null && isBeforeDay(endDate, todayStart, timeZone);

  return {
    startDate: todayStart,
    endDate: isEndDateExpired ? null : endDate,
  };
}
