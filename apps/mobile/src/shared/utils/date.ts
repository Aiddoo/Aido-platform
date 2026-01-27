import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import isoWeek from 'dayjs/plugin/isoWeek';
import isToday from 'dayjs/plugin/isToday';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import { times } from 'es-toolkit/compat';

dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);
dayjs.extend(isToday);
dayjs.locale('ko');

// Format
export const formatDate = (date: Date | string | number): string => {
  const d = dayjs(date);
  return d.isValid() ? d.format('YYYY-MM-DD') : '';
};

export const formatTime = (date: Date | string | number): string => {
  const d = dayjs(date);
  return d.isValid() ? d.format('A h:mm') : '';
};

// Predicates
export const isDateToday = (date: Date): boolean => {
  return dayjs(date).isToday();
};

export const isSameDay = (date1: Date, date2: Date): boolean => {
  return dayjs(date1).isSame(date2, 'day');
};

export const isSameMonth = (date1: Date, date2: Date): boolean => {
  return dayjs(date1).isSame(date2, 'month');
};

export const isSunday = (date: Date): boolean => {
  return date.getDay() === 0;
};

export const isSaturday = (date: Date): boolean => {
  return date.getDay() === 6;
};

// Calendar
export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

export const getWeekHeaderText = (date: Date): string => {
  const d = dayjs(date);
  const weekOfMonth = Math.ceil(d.date() / 7);
  return `${d.format('M')}월 ${weekOfMonth}주차`;
};

export const getMonthHeaderText = (date: Date): string => {
  return dayjs(date).format('YYYY년 M월');
};

export const getWeekStart = (date: Date): Date => {
  return dayjs(date).startOf('week').toDate();
};

export const getWeekEnd = (date: Date): Date => {
  return dayjs(date).endOf('week').toDate();
};

export const getPreviousWeek = (date: Date): Date => {
  return dayjs(date).subtract(1, 'week').toDate();
};

export const getNextWeek = (date: Date): Date => {
  return dayjs(date).add(1, 'week').toDate();
};

export const getPreviousMonth = (date: Date): Date => {
  return dayjs(date).subtract(1, 'month').toDate();
};

export const getNextMonth = (date: Date): Date => {
  return dayjs(date).add(1, 'month').toDate();
};

export const getWeekDates = (weekStartDate: Date): Date[] => {
  return times(7, (i) => dayjs(weekStartDate).add(i, 'day').toDate());
};

export const getMonthWeeks = (displayDate: Date): Date[][] => {
  const display = dayjs(displayDate);
  const monthStart = display.startOf('month');
  const monthEnd = display.endOf('month');

  const calendarStart = monthStart.startOf('week');
  const calendarEnd = monthEnd.endOf('week');

  const weeks: Date[][] = [];
  let currentWeekStart = calendarStart;

  while (currentWeekStart.isBefore(calendarEnd) || currentWeekStart.isSame(calendarEnd, 'day')) {
    weeks.push(getWeekDates(currentWeekStart.toDate()));
    currentWeekStart = currentWeekStart.add(1, 'week');
  }

  return weeks;
};

export const getCurrentWeekStart = (): Date => {
  return getWeekStart(new Date());
};

export const getCurrentMonthStart = (): Date => {
  return dayjs().startOf('month').toDate();
};
