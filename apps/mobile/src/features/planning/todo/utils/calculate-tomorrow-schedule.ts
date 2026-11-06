import { isBeforeDay } from '@src/features/planning/todo/utils/calendar-date';
import dayjs from 'dayjs';

interface TomorrowSchedule {
  startDate: Date;
  endDate: Date | null;
}

export const calculateTomorrowSchedule = (
  endDateObj: Date | null,
  today: Date,
): TomorrowSchedule => {
  const tomorrow = dayjs(today).startOf('day').add(1, 'day').toDate();
  const isEndDateExpired = endDateObj != null && isBeforeDay(endDateObj, tomorrow);

  return {
    startDate: tomorrow,
    endDate: isEndDateExpired ? null : endDateObj,
  };
};
