import { getNextDay, isBeforeDay, startOfDay } from '@src/features/todo/utils/calendar-date';

interface TomorrowSchedule {
  startDate: Date;
  endDate: Date | null;
}

export const calculateTomorrowSchedule = (
  endDateObj: Date | null,
  today: Date,
): TomorrowSchedule => {
  const tomorrow = getNextDay(startOfDay(today));
  const isEndDateExpired = endDateObj != null && isBeforeDay(endDateObj, tomorrow);

  return {
    startDate: tomorrow,
    endDate: isEndDateExpired ? null : endDateObj,
  };
};
