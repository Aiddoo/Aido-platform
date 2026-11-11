import { type DayOfWeek, TODO_SERIES_LIMITS } from '@aido/api/vocabulary';

export const TODO_REPEAT_COUNT = {
  MIN: 1,
  MAX: TODO_SERIES_LIMITS.MAX_COUNT,
  DEFAULT: 10,
} as const;

export const TODO_REPEAT_WEEKDAYS: readonly DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
export const TODO_REPEAT_WEEKEND_DAYS: readonly DayOfWeek[] = ['SAT', 'SUN'];
