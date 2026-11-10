export abstract class ReminderTimezoneCachePort {
  abstract invalidateActiveTimezones(): Promise<void>;
}
