import { i18n, t } from '@src/shared/i18n';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import { times } from 'es-toolkit/compat';

import { getCalendarWeek } from './calendar-week';
import { formatClockTime, formatDateLabel, type DateFormatContext } from './date-format';

dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);
// dayjs 전역 locale은 i18n init(languageChanged 리스너)이 관리한다

// Format
export const formatDate = (date: Date | string | number): string => {
  const d = dayjs(date);
  return d.isValid() ? d.format('YYYY-MM-DD') : '';
};

function getDateFormatContext(): DateFormatContext {
  return {
    locale: i18n.language.startsWith('ko') ? 'ko-KR' : 'en-US',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

export const formatTime = (
  date: Date | string | number,
  timeFormat: 'TWELVE_HOUR' | 'TWENTY_FOUR_HOUR' = 'TWELVE_HOUR',
): string => formatClockTime(dayjs(date).toDate(), timeFormat, getDateFormatContext());

export const formatFullDate = (date: Date | string | number): string =>
  formatDateLabel(dayjs(date).toDate(), 'fullDate', getDateFormatContext());

export const formatMonthDay = (date: Date | string | number): string =>
  formatDateLabel(dayjs(date).toDate(), 'monthDay', getDateFormatContext());

export const formatDayOfMonth = (date: Date | string | number): string =>
  formatDateLabel(dayjs(date).toDate(), 'dayOfMonth', getDateFormatContext());

export const formatTime24 = (date: Date | string | number): string =>
  formatClockTime(dayjs(date).toDate(), 'TWENTY_FOUR_HOUR', getDateFormatContext());

export const toDate = (date: Date | string | number): Date => {
  const d = dayjs(date);
  return d.isValid() ? d.toDate() : new Date(date);
};

export const toNullableDate = (date?: Date | string | number | null): Date | null => {
  if (date == null) {
    return null;
  }

  const d = dayjs(date);
  return d.isValid() ? d.toDate() : null;
};

// Predicates
export const isDateToday = (date: Date, now: Date = new Date()): boolean => {
  return dayjs(date).isSame(now, 'day');
};

export const isSameDay = (date1: Date, date2: Date): boolean => {
  return dayjs(date1).isSame(date2, 'day');
};

export const isSameMonth = (date1: Date, date2: Date): boolean => {
  return dayjs(date1).isSame(date2, 'month');
};

export const isSameWeek = (date1: Date, date2: Date): boolean => {
  return dayjs(date1).isSame(date2, 'week');
};

export const isAfterDay = (date1: Date, date2: Date): boolean => {
  return dayjs(date1).isAfter(date2, 'day');
};

export const isBeforeDay = (date1: Date, date2: Date): boolean => {
  return dayjs(date1).isBefore(date2, 'day');
};

export const isSunday = (date: Date): boolean => {
  return date.getDay() === 0;
};

export const isSaturday = (date: Date): boolean => {
  return date.getDay() === 6;
};

// DayOfWeek
import { DAY_OF_WEEK_MAP, type DayOfWeek } from '@aido/api';

/** DayOfWeek 배열을 요일 순서로 정렬 후 로케일 라벨로 변환 (예: "월, 수, 금") */
export const formatDaysOfWeek = (daysOfWeek: DayOfWeek[]): string =>
  [...daysOfWeek]
    .sort((a, b) => DAY_OF_WEEK_MAP[a] - DAY_OF_WEEK_MAP[b])
    .map((day) => t(`common:daysOfWeek.${day}`))
    .join(', ');

/** DayOfWeek → 로케일 요일 라벨 */
export const getDayOfWeekLabel = (day: DayOfWeek): string => t(`common:daysOfWeek.${day}`);

// Calendar

/** 캘린더 헤더용 요일 라벨 (일요일 시작, Date#getDay() 인덱스와 일치) */
export const getWeekdayLabels = (): string[] =>
  (['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const).map((day) =>
    t(`common:daysOfWeek.${day}`),
  );

export const getWeekHeaderText = (date: Date): string => {
  const week = getCalendarWeek(date);
  return t('common:calendar.weekHeader', {
    month: formatDateLabel(week.start, 'month', getDateFormatContext()),
    week: week.weekOfMonth,
  });
};

export const getMonthHeaderText = (date: Date): string => {
  return formatDateLabel(dayjs(date).toDate(), 'yearMonth', getDateFormatContext());
};

export const getWeekStart = (date: Date): Date => {
  return getCalendarWeek(date).start;
};

export const getMonthStart = (date: Date): Date => {
  return dayjs(date).startOf('month').toDate();
};

export const getWeekEnd = (date: Date): Date => {
  return getCalendarWeek(date).end;
};

export const getNextDay = (date: Date): Date => {
  return dayjs(date).add(1, 'day').toDate();
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

export const addWeeks = (date: Date, weeks: number): Date => {
  return dayjs(date).add(weeks, 'week').toDate();
};

export const addMonths = (date: Date, months: number): Date => {
  return dayjs(date).add(months, 'month').toDate();
};

/** 두 날짜의 주 단위 차이 (date1 - date2, startOf('week') 기준으로 정규화) */
export const diffWeeks = (date1: Date, date2: Date): number => {
  return dayjs(date1).startOf('week').diff(dayjs(date2).startOf('week'), 'week');
};

/** 두 날짜의 월 단위 차이 (date1 - date2, startOf('month') 기준으로 정규화) */
export const diffMonths = (date1: Date, date2: Date): number => {
  return dayjs(date1).startOf('month').diff(dayjs(date2).startOf('month'), 'month');
};

/** 그 주 안에서 요일을 n번째로 이동 (0=일, 6=토) */
export const withDayOfWeek = (date: Date, dayOfWeek: number): Date => {
  return dayjs(date).day(dayOfWeek).toDate();
};

/** 그 달 안에서 날짜를 n일로 이동 (월말이면 자동 clamp, 예: 1/31 → 2월은 2/28) */
export const withDayOfMonth = (date: Date, dayOfMonth: number): Date => {
  return dayjs(date).date(dayOfMonth).toDate();
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

export const getDateSectionKey = (date: Date, referenceDate: Date) => {
  const now = dayjs(referenceDate);
  const target = dayjs(date);

  if (target.isSame(now, 'day')) return 'today';
  if (now.subtract(1, 'day').isSame(target, 'day')) return 'yesterday';
  if (target.isSame(now, 'isoWeek')) return 'thisWeek';
  if (target.isSame(now, 'month')) return 'thisMonth';
  return 'earlier';
};

export const getDateSectionLabel = (date: Date, referenceDate: Date = new Date()): string =>
  t(`common:dateSections.${getDateSectionKey(date, referenceDate)}`);

/** 상대 시간 포맷 ("방금 전", "5분 전", "3시간 전", "2일 전", "1월 5일", "2025.1.5") */
export const formatRelativeTime = (date: Date, referenceDate: Date = new Date()): string => {
  const now = dayjs(referenceDate);
  const target = dayjs(date);
  const diffMinutes = now.diff(target, 'minute');
  const diffHours = now.diff(target, 'hour');
  const diffDays = now.diff(target, 'day');

  if (diffMinutes < 1) return t('common:relativeTime.justNow');
  if (diffMinutes < 60) return t('common:relativeTime.minutesAgo', { count: diffMinutes });
  if (diffHours < 24) return t('common:relativeTime.hoursAgo', { count: diffHours });
  if (diffDays < 7) return t('common:relativeTime.daysAgo', { count: diffDays });
  if (target.year() === now.year()) return target.format(t('common:dateFormats.monthDay'));
  return target.format(t('common:dateFormats.shortDate'));
};
