import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export abstract class PushTokenCachePort {
  abstract invalidatePushTokens(userId: UserId): Promise<void>;
}
