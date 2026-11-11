import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export abstract class UserProfileInvalidatorPort {
  abstract invalidateUserProfile(userId: UserId): Promise<void>;
}
