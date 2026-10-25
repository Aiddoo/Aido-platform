import { DAY_OF_WEEK_MAP, type DayOfWeek } from '@aido/api';
import { t } from '@src/shared/i18n';
import dayjs from 'dayjs';
import { range } from 'es-toolkit';

import { getCalendarWeek, getCalendarWeekOfDateKey } from './calendar-week';
import { type DateFormatContext, formatDateKeyLabel, formatRelativeTime } from './date-format';
import { addDaysToDateKey } from './date-key';

// Format
export const formatDate = (date: Date | string | number): string => {
  const d = dayjs(date);
  return d.isValid() ? d.format('YYYY-MM-DD') : '';
};

function toCatalogLanguage(context: DateFormatContext): 'ko' | 'en' {
  return context.locale === 'ko-KR' ? 'ko' : 'en';
}

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
export const isDateToday = (date: Date, now: Date): boolean => {
  return dayjs(date).isSame(now, 'day');
};

export const isSameDay = (date1: Date, date2: Date): boolean => {
  return dayjs(date1).isSame(date2, 'day');
};

export const isSameMonth = (date1: Date, date2: Date): boolean => {
  return dayjs(date1).isSame(date2, 'month');
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

/** 달력 주 헤더 (ko: "10월 3주차", en: "Week 3 of Oct"). 주가 시작한 달 기준이다. */
export const formatWeekOfMonthLabel = (dateKey: string, context: DateFormatContext): string => {
  const week = getCalendarWeekOfDateKey(dateKey);
  return t('common:calendar.weekHeader', {
    lng: toCatalogLanguage(context),
    month: formatDateKeyLabel(week.startDateKey, 'month', context),
    week: week.weekOfMonth,
  });
};

export const getWeekStart = (date: Date): Date => {
  return getCalendarWeek(date).start;
};

export const startOfDay = (date: Date): Date => {
  return dayjs(date).startOf('day').toDate();
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

/** 두 날짜의 주 단위 차이 (date1 - date2, 앱 달력 주의 시작으로 정규화) */
export const diffWeeks = (date1: Date, date2: Date): number => {
  return dayjs(getCalendarWeek(date1).start).diff(getCalendarWeek(date2).start, 'week');
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
  return range(7).map((i) => dayjs(weekStartDate).add(i, 'day').toDate());
};

export const getMonthWeeks = (displayDate: Date): Date[][] => {
  const display = dayjs(displayDate);
  const lastWeekStart = dayjs(getCalendarWeek(display.endOf('month').toDate()).start);

  const weeks: Date[][] = [];
  let currentWeekStart = dayjs(getCalendarWeek(display.startOf('month').toDate()).start);

  while (!currentWeekStart.isAfter(lastWeekStart, 'day')) {
    weeks.push(getWeekDates(currentWeekStart.toDate()));
    currentWeekStart = currentWeekStart.add(1, 'week');
  }

  return weeks;
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
  const display = dayjs(displayDate);
  return {
    rangeStart: getCalendarWeekOfDateKey(display.startOf('month').format('YYYY-MM-DD'))
      .startDateKey,
    rangeEnd: getCalendarWeekOfDateKey(display.endOf('month').format('YYYY-MM-DD')).endDateKey,
  };
};

/** 주간 뷰 범위 */
export const getWeekRange = (displayDate: Date): { rangeStart: string; rangeEnd: string } => {
  const week = getCalendarWeekOfDateKey(formatDate(displayDate));
  return { rangeStart: week.startDateKey, rangeEnd: week.endDateKey };
};

export type DateSectionKey = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'earlier';

/** 목록 날짜 섹션. 두 날짜 key를 그대로 비교하며 주는 앱 달력 주(일요일 시작)다. */
export const getDateSectionKey = (dateKey: string, todayDateKey: string): DateSectionKey => {
  if (dateKey === todayDateKey) {
    return 'today';
  }
  if (dateKey === addDaysToDateKey(todayDateKey, -1)) {
    return 'yesterday';
  }
  if (
    getCalendarWeekOfDateKey(dateKey).startDateKey ===
    getCalendarWeekOfDateKey(todayDateKey).startDateKey
  ) {
    return 'thisWeek';
  }
  if (dateKey.slice(0, 7) === todayDateKey.slice(0, 7)) {
    return 'thisMonth';
  }
  return 'earlier';
};

/** 상대 시간 ("방금 전", "5분 전", "3시간 전", "2일 전", "1월 5일", "2025. 1. 5.") */
export const formatRelativeTimeLabel = (
  date: Date,
  now: Date,
  context: DateFormatContext,
): string => {
  const lng = toCatalogLanguage(context);
  return formatRelativeTime(
    date,
    now,
    {
      justNow: t('common:relativeTime.justNow', { lng }),
      minutesAgo: (count) => t('common:relativeTime.minutesAgo', { count, lng }),
      hoursAgo: (count) => t('common:relativeTime.hoursAgo', { count, lng }),
      daysAgo: (count) => t('common:relativeTime.daysAgo', { count, lng }),
    },
    context,
  );
};
