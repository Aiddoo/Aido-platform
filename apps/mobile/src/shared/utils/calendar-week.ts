import dayjs from 'dayjs';

export function getCalendarWeek(date: Date) {
  const referenceDate = dayjs(date);
  const start = referenceDate.subtract(referenceDate.day(), 'day').startOf('day');
  return {
    start: start.toDate(),
    end: start.add(6, 'day').endOf('day').toDate(),
    weekOfMonth: Math.ceil(start.date() / 7),
  };
}
