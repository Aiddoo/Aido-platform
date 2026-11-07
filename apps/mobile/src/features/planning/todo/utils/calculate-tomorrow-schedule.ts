import type { Instant } from '@src/shared/date/instant';
import { addLocalDays } from '@src/shared/date/local-day';

import { isBeforeDay } from './calendar-date';

interface TomorrowSchedule {
  startDate: Date;
  endDate: Instant | null;
}

export function calculateTomorrowSchedule(
  endDate: Instant | null,
  today: Date,
  timeZone: string,
): TomorrowSchedule {
  const tomorrow = addLocalDays(today, 1, timeZone);
  const isEndDateExpired = endDate != null && isBeforeDay(endDate, tomorrow, timeZone);

  return {
    startDate: tomorrow,
    endDate: isEndDateExpired ? null : endDate,
  };
}
