import { getNextDay, isBeforeDay } from '@src/shared/utils/date';

interface TomorrowSchedule {
  startDate: Date;
  endDate: Date | null;
}

export const calculateTomorrowSchedule = (
  endDateObj: Date | null,
  today?: Date,
): TomorrowSchedule => {
  const tomorrow = getNextDay(today ?? new Date());
  const isEndDateExpired = endDateObj != null && isBeforeDay(endDateObj, tomorrow);

  return {
    startDate: tomorrow,
    endDate: isEndDateExpired ? null : endDateObj,
  };
};
