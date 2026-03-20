import { isBeforeDay } from '@src/shared/utils/date';

interface TodaySchedule {
  startDate: Date;
  endDate: Date | null;
}

export const calculateTodaySchedule = (endDateObj: Date | null, today?: Date): TodaySchedule => {
  const todayDate = today ?? new Date();
  const todayStart = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
  const isEndDateExpired = endDateObj != null && isBeforeDay(endDateObj, todayStart);

  return {
    startDate: todayStart,
    endDate: isEndDateExpired ? null : endDateObj,
  };
};
