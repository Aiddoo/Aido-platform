export const USER_PREFERENCE_DEFAULTS = {
  PUSH_ENABLED: false,
  NIGHT_PUSH_ENABLED: false,
} as const;

export const NIGHT_TIME_CONFIG = {
  START_HOUR: 21,
  END_HOUR: 8,
  KST_OFFSET_HOURS: 9,
} as const;
