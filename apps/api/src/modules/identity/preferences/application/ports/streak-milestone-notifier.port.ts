import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export abstract class StreakMilestoneNotifierPort {
  abstract notifyStreak3Reached(userId: UserId): Promise<void>;
}
