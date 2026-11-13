import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export abstract class QuietHoursReaderPort {
  /** 지금 받는 사람 현지 야간(21:00–08:00)이라 다음 허용 시각으로 미룰 사용자의 id 값 */
  abstract findUsersInQuietHours(
    userIds: readonly UserId[],
    at: Temporal.Instant,
  ): Promise<ReadonlySet<string>>;
}
