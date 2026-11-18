import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 참여 유도 알림을 다음 허용 시각으로 미루려는 발신자가 야간(21:00–08:00) 사용자를 고른다
export abstract class PushQuietHoursReaderPort {
  abstract findUsersInQuietHours(
    userIds: readonly UserId[],
    at: Temporal.Instant,
  ): Promise<ReadonlySet<string>>;
}
