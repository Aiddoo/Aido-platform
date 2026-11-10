import { Inject, Injectable } from "@nestjs/common";

import {
  ENTITLEMENT_SUBSCRIPTION_INVALIDATOR,
  type EntitlementSubscriptionInvalidatorPort,
} from "#api/modules/access/access-entitlement.public";
import {
  USER_PROFILE_INVALIDATOR,
  type UserProfileInvalidatorPort,
} from "#api/modules/identity/identity-user-access.public";

import { PremiumAccessCachePort } from "../../application/ports/premium-access-cache.port.js";

@Injectable()
export class PremiumAccessCacheAdapter extends PremiumAccessCachePort {
  readonly #subscriptionCache: EntitlementSubscriptionInvalidatorPort;
  readonly #profileCache: UserProfileInvalidatorPort;

  constructor(
    @Inject(ENTITLEMENT_SUBSCRIPTION_INVALIDATOR)
    subscriptionCache: EntitlementSubscriptionInvalidatorPort,
    @Inject(USER_PROFILE_INVALIDATOR) profileCache: UserProfileInvalidatorPort,
  ) {
    super();
    this.#subscriptionCache = subscriptionCache;
    this.#profileCache = profileCache;
  }

  async invalidate(userId: string): Promise<void> {
    await Promise.all([
      this.#subscriptionCache.invalidateSubscription(userId),
      this.#profileCache.invalidateUserProfile(userId),
    ]);
  }
}
