import { PremiumAccessCachePort } from "#api/modules/billing/premium-grants/application/ports/premium-access-cache.port";

export class RecordingPremiumAccessCache extends PremiumAccessCachePort {
  readonly invalidatedUserIds: string[] = [];
  failure: Error | null = null;

  async invalidate(userId: string): Promise<void> {
    if (this.failure != null) {
      throw this.failure;
    }
    this.invalidatedUserIds.push(userId);
  }
}
