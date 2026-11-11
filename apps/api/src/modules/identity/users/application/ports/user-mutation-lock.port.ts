import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export abstract class UserMutationLockPort {
  abstract lockById(userId: UserId): Promise<boolean>;
}
