import { isBeforeDay } from '@src/features/planning/todo/utils/calendar-date';
import dayjs from 'dayjs';

interface TodaySchedule {
  startDate: Date;
  endDate: Date | null;
}

export const calculateTodaySchedule = (endDateObj: Date | null, today: Date): TodaySchedule => {
  const todayStart = dayjs(today).startOf('day').toDate();
  const isEndDateExpired = endDateObj != null && isBeforeDay(endDateObj, todayStart);

  return {
    startDate: todayStart,
    endDate: isEndDateExpired ? null : endDateObj,
  };
};
