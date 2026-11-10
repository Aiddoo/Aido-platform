export abstract class QuietHoursReaderPort {
  /** 지금 받는 사람 현지 야간(21:00–08:00)이라 다음 허용 시각으로 미룰 사용자 */
  abstract findUsersInQuietHours(
    userIds: readonly string[],
    at: Temporal.Instant,
  ): Promise<ReadonlySet<string>>;
}
