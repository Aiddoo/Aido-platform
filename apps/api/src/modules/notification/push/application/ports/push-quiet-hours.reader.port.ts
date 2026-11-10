// 다른 Context가 옮길 때까지 옛 Symbol을 같은 인스턴스의 별칭으로 남긴다
export const PUSH_QUIET_HOURS_READER = Symbol("PUSH_QUIET_HOURS_READER");

// 참여 유도 알림을 다음 허용 시각으로 미루려는 발신자가 야간(21:00–08:00) 사용자를 고른다
export abstract class PushQuietHoursReaderPort {
  abstract findUsersInQuietHours(
    userIds: readonly string[],
    at: Date,
  ): Promise<ReadonlySet<string>>;
}
