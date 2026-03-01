export const USER_PREFERENCE_DEFAULTS = {
  PUSH_ENABLED: false,
  NIGHT_PUSH_ENABLED: false,
  TIMEZONE: 'UTC',
  MORNING_REMINDER_HOUR: 8,
  EVENING_REMINDER_HOUR: 18,
} as const;

export const NIGHT_TIME_CONFIG = {
  START_HOUR: 21,
  END_HOUR: 8,
} as const;

export const MORNING_REMINDER_HOUR_RANGE = {
  MIN: 0,
  MAX: 11,
} as const;

export const EVENING_REMINDER_HOUR_RANGE = {
  MIN: 12,
  MAX: 23,
} as const;
