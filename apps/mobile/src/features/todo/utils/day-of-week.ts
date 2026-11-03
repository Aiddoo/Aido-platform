import { DAY_OF_WEEK_MAP, type DayOfWeek } from '@aido/api';
import {
  diffDateKeysInDays,
  getDayOfWeekOfDateKey,
  toDeviceDateKey,
} from '@src/shared/utils/date-key';

import { ALL_DAYS_OF_WEEK } from '../constants/day-of-week';

export const getDayOfWeekFromDate = (date: Date): DayOfWeek | undefined => {
  const weekday = getDayOfWeekOfDateKey(toDeviceDateKey(date));
  return ALL_DAYS_OF_WEEK.find((day) => DAY_OF_WEEK_MAP[day] === weekday);
};

export const hasSelectedDayInRange = (
  startDate: Date,
  endDate: Date,
  selectedDays: DayOfWeek[],
): boolean => {
  if (selectedDays.length === 0) {
    return false;
  }

  const startDateKey = toDeviceDateKey(startDate);
  const diffDays = diffDateKeysInDays(startDateKey, toDeviceDateKey(endDate));

  if (diffDays >= 6) {
    return true;
  }

  const selectedJsDays = new Set(selectedDays.map((d) => DAY_OF_WEEK_MAP[d]));
  const startDay = getDayOfWeekOfDateKey(startDateKey);
  for (let i = 0; i <= diffDays; i++) {
    if (selectedJsDays.has((startDay + i) % 7)) {
      return true;
    }
  }
  return false;
};
