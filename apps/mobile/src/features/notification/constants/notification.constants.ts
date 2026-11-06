export const SETTINGS_TIME_RANGE = {
  morning: { minimumTime: { hour: 0, minute: 0 }, maximumTime: { hour: 11, minute: 59 } },
  evening: { minimumTime: { hour: 12, minute: 0 }, maximumTime: { hour: 23, minute: 59 } },
} as const;
