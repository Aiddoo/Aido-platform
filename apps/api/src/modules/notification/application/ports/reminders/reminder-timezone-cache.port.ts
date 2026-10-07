export const REMINDER_TIMEZONE_CACHE = Symbol("REMINDER_TIMEZONE_CACHE");

export interface ReminderTimezoneCachePort {
  invalidateActiveTimezones(): Promise<void>;
}
