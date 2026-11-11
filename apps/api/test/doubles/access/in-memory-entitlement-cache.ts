import type { EntitlementCacheInvalidatorPort } from "#api/modules/access/entitlements/application/ports/entitlement-cache-invalidator.port";
import {
  type CachedAccessState,
  EntitlementCachePort,
} from "#api/modules/access/entitlements/application/ports/entitlement-cache.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// TTL 없이 비울 때까지 값을 둔다. 캐시가 남은 동안 저장소가 바뀌는 상황을 만든다
export class InMemoryEntitlementCache
  extends EntitlementCachePort
  implements EntitlementCacheInvalidatorPort
{
  readonly entries = new Map<string, CachedAccessState>();

  async wrap(
    userId: UserId,
    factory: () => Promise<CachedAccessState>,
  ): Promise<CachedAccessState | null> {
    const cached = this.entries.get(userId.value);
    if (cached != null) {
      return { ...cached };
    }
    const value = await factory();
    this.entries.set(userId.value, { ...value });
    return value;
  }

  async invalidate(userId: UserId): Promise<void> {
    this.entries.delete(userId.value);
  }

  async invalidateEntitlements(userId: UserId): Promise<void> {
    await this.invalidate(userId);
  }
}
