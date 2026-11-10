// identity가 옮길 때까지 옛 Symbol을 같은 인스턴스의 별칭으로 남긴다
export const REMINDER_TIMEZONE_CACHE = Symbol("REMINDER_TIMEZONE_CACHE");

export abstract class ReminderTimezoneCachePort {
  abstract invalidateActiveTimezones(): Promise<void>;
}
