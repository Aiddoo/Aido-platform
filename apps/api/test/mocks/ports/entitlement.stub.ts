import type {
  EntitlementCachePort,
  CachedSubscriptionState,
} from "#api/modules/access/application/ports/entitlement/entitlement-cache.port";
import type {
  EntitlementDatabasePort,
  EntitlementUserState,
} from "#api/modules/access/application/ports/entitlement/entitlement-state.port";

export class StubEntitlementDatabase implements EntitlementDatabasePort {
  readonly users = new Map<string, EntitlementUserState>();
  async findUserState(userId: string): Promise<EntitlementUserState | null> {
    const user = this.users.get(userId);
    return user ? { ...user } : null;
  }
}

export class StubEntitlementCache implements EntitlementCachePort {
  readonly snapshots = new Map<string, CachedSubscriptionState>();
  async wrapSubscription(
    userId: string,
    factory: () => Promise<CachedSubscriptionState>,
  ): Promise<CachedSubscriptionState | null> {
    const cached = this.snapshots.get(userId);
    if (cached) return { ...cached };
    const snapshot = await factory();
    this.snapshots.set(userId, { ...snapshot });
    return snapshot;
  }
  async invalidateSubscription(userId: string): Promise<void> {
    this.snapshots.delete(userId);
  }
}
