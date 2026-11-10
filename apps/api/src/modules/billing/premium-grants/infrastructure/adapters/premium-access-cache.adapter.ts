import { Inject, Injectable } from "@nestjs/common";

import { EntitlementCacheInvalidatorPort } from "#api/modules/access/entitlements/access-entitlements.public";
import { UserProfileInvalidatorPort } from "#api/modules/identity/identity-user-access.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { PremiumAccessCachePort } from "../../application/ports/premium-access-cache.port.js";

@Injectable()
export class PremiumAccessCacheAdapter extends PremiumAccessCachePort {
  readonly #entitlementCache: Pick<EntitlementCacheInvalidatorPort, "invalidateEntitlements">;
  readonly #profileCache: UserProfileInvalidatorPort;

  constructor(
    @Inject(EntitlementCacheInvalidatorPort)
    entitlementCache: Pick<EntitlementCacheInvalidatorPort, "invalidateEntitlements">,
    @Inject(UserProfileInvalidatorPort) profileCache: UserProfileInvalidatorPort,
  ) {
    super();
    this.#entitlementCache = entitlementCache;
    this.#profileCache = profileCache;
  }

  async invalidate(userId: string): Promise<void> {
    await Promise.all([
      this.#entitlementCache.invalidateEntitlements(UserId.reconstitute(userId)),
      this.#profileCache.invalidateUserProfile(userId),
    ]);
  }
}
