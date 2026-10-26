export const PUSH_QUIET_HOURS_READER = Symbol("PUSH_QUIET_HOURS_READER");

/** 참여 유도 알림을 다음 허용 시각으로 미루려는 발신자가 야간(21:00–08:00) 사용자를 고른다. */
export interface PushQuietHoursReaderPort {
  findUsersInQuietHours(userIds: readonly string[], at: Date): Promise<ReadonlySet<string>>;
}
