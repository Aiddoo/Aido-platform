import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export abstract class BillingUserLockPort {
  /** 사용자 행을 잠근다. 사용자가 없으면 false다. */
  abstract lockById(userId: UserId): Promise<boolean>;
}
