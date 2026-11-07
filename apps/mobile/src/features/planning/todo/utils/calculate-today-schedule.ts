import { isBeforeDay } from '@src/features/planning/todo/utils/calendar-date';
import dayjs from 'dayjs';

interface TodaySchedule {
  startDate: Date;
  endDate: Date | null;
}

export const calculateTodaySchedule = (
  endDateObj: Date | null,
  today: Date,
  timeZone: string,
): TodaySchedule => {
  const todayStart = dayjs(today).startOf('day').toDate();
  const isEndDateExpired = endDateObj != null && isBeforeDay(endDateObj, todayStart, timeZone);

  return {
    startDate: todayStart,
    endDate: isEndDateExpired ? null : endDateObj,
  };
};
