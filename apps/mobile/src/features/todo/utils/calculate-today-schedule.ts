import { isBeforeDay, startOfDay } from '@src/features/todo/utils/calendar-date';

interface TodaySchedule {
  startDate: Date;
  endDate: Date | null;
}

export const calculateTodaySchedule = (endDateObj: Date | null, today: Date): TodaySchedule => {
  const todayStart = startOfDay(today);
  const isEndDateExpired = endDateObj != null && isBeforeDay(endDateObj, todayStart);

  return {
    startDate: todayStart,
    endDate: isEndDateExpired ? null : endDateObj,
  };
};
