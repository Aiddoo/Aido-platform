import type {
  EntitlementCachePort,
  CachedSubscriptionState,
} from "#api/modules/access/application/ports/entitlement/entitlement-cache.port";
import type {
  EntitlementDatabasePort,
  EntitlementUserState,
} from "#api/modules/access/application/ports/entitlement/entitlement-state.port";
import {
  NO_RESOURCE_BONUSES,
  type ResourceBonuses,
} from "#api/modules/access/domain/policies/entitlement/entitlement-limits.policy";

/** 기한을 생략하면 웹훅이 바꿀 때까지 유지하는 기존 projection으로 본다. */
type StubEntitlementUserState = Omit<EntitlementUserState, "accessDeadline"> &
  Partial<Pick<EntitlementUserState, "accessDeadline">>;

export class StubEntitlementDatabase implements EntitlementDatabasePort {
  readonly users = new Map<string, StubEntitlementUserState>();
  readonly resourceBonuses = new Map<string, ResourceBonuses>();
  async findUserState(userId: string): Promise<EntitlementUserState | null> {
    const user = this.users.get(userId);
    if (user == null) return null;
    return {
      role: user.role,
      subscriptionStatus: user.subscriptionStatus,
      accessDeadline: user.accessDeadline == null ? null : new Date(user.accessDeadline),
    };
  }
  async findResourceBonuses(userId: string): Promise<ResourceBonuses> {
    return { ...(this.resourceBonuses.get(userId) ?? NO_RESOURCE_BONUSES) };
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
