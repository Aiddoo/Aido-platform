import { PremiumAccessCachePort } from "#api/modules/billing/premium-grants/application/ports/premium-access-cache.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export class RecordingPremiumAccessCache extends PremiumAccessCachePort {
  readonly invalidatedUserIds: string[] = [];
  failure: Error | null = null;

  async invalidate(userId: UserId): Promise<void> {
    if (this.failure != null) {
      throw this.failure;
    }
    this.invalidatedUserIds.push(userId.value);
  }
}
