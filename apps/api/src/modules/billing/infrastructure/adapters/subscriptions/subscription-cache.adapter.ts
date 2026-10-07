import { Inject, Injectable } from "@nestjs/common";

import {
  ENTITLEMENT_SUBSCRIPTION_INVALIDATOR,
  type EntitlementSubscriptionInvalidatorPort,
} from "#api/modules/access/access-entitlement.public";
import {
  USER_PROFILE_INVALIDATOR,
  type UserProfileInvalidatorPort,
} from "#api/modules/identity/identity-user-access.public";

import type { SubscriptionCachePort } from "../../../application/ports/subscriptions/subscription-cache.port.js";

@Injectable()
export class SubscriptionCacheAdapter implements SubscriptionCachePort {
  constructor(
    @Inject(ENTITLEMENT_SUBSCRIPTION_INVALIDATOR)
    private readonly subscriptionCache: EntitlementSubscriptionInvalidatorPort,
    @Inject(USER_PROFILE_INVALIDATOR) private readonly profileCache: UserProfileInvalidatorPort,
  ) {}

  async invalidate(userId: string): Promise<void> {
    await Promise.all([
      this.subscriptionCache.invalidateSubscription(userId),
      this.profileCache.invalidateUserProfile(userId),
    ]);
  }
}
