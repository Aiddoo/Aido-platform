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

// Todo 날짜 유틸

/** 투두가 특정 날짜에 해당하는지 (YYYY-MM-DD 문자열 사전순 비교) */
export const todoOverlapsDate = (
  todoStartDate: string,
  todoEndDate: string | null,
  targetDate: string,
): boolean => {
  const effectiveEnd = todoEndDate ?? todoStartDate;
  return todoStartDate <= targetDate && effectiveEnd >= targetDate;
};

/** 캘린더 그리드 범위 (월간 뷰 - 앞뒤 패딩 주 포함) */
export const getCalendarRange = (displayDate: Date): { rangeStart: string; rangeEnd: string } => {
  const d = dayjs(displayDate);
  return {
    rangeStart: d.startOf('month').startOf('week').format('YYYY-MM-DD'),
    rangeEnd: d.endOf('month').endOf('week').format('YYYY-MM-DD'),
  };
};

/** 주간 뷰 범위 */
export const getWeekRange = (displayDate: Date): { rangeStart: string; rangeEnd: string } => {
  const d = dayjs(displayDate);
  return {
    rangeStart: d.startOf('week').format('YYYY-MM-DD'),
    rangeEnd: d.endOf('week').format('YYYY-MM-DD'),
  };
};

/** 날짜를 섹션 라벨로 변환 ("오늘", "어제", "이번 주", "이번 달", "이전") */
export const getDateSectionLabel = (date: Date): string => {
  const now = dayjs();
  const target = dayjs(date);

  if (target.isToday()) return '오늘';
  if (now.subtract(1, 'day').isSame(target, 'day')) return '어제';
  if (target.isSame(now, 'isoWeek')) return '이번 주';
  if (target.isSame(now, 'month')) return '이번 달';
  return '이전';
};

/** 상대 시간 포맷 ("방금 전", "5분 전", "3시간 전", "2일 전", "1월 5일", "2025.1.5") */
export const formatRelativeTime = (date: Date): string => {
  const now = dayjs();
  const target = dayjs(date);
  const diffMinutes = now.diff(target, 'minute');
  const diffHours = now.diff(target, 'hour');
  const diffDays = now.diff(target, 'day');

  if (diffMinutes < 1) return '방금 전';
  if (diffMinutes < 60) return `${diffMinutes}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;
  if (target.year() === now.year()) return target.format('M월 D일');
  return target.format('YYYY.M.D');
};
