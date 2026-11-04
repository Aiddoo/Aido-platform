import type { DayOfWeek } from '@aido/api/vocabulary';

export const TODO_REPEAT_COUNT = {
  MIN: 2,
  MAX: 365,
  DEFAULT: 10,
} as const;

export const TODO_REPEAT_DEFAULT_UNTIL_DAYS = 28;

export const TODO_REPEAT_MONTH_DAY_CLAMP_FROM = 29;

export const TODO_REPEAT_WEEKDAYS: readonly DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
export const TODO_REPEAT_WEEKEND_DAYS: readonly DayOfWeek[] = ['SAT', 'SUN'];
