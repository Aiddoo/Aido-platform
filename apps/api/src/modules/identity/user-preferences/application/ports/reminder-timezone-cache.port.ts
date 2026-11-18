/** 시간대가 바뀌면 리마인더가 읽는 활성 시간대 목록 캐시를 비운다 */
export abstract class ReminderTimezoneCachePort {
  abstract invalidateActiveTimezones(): Promise<void>;
}
