import { StoreEntitlementReaderPort } from "#api/modules/billing/premium-grants/application/ports/store-entitlement.reader.port";
import type { StoreSubscriptionEntitlement } from "#api/modules/billing/shared/domain/premium-access.domain-service";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { InMemorySubscriptionRepository } from "./in-memory-subscription.repository.js";

// 구독 저장소가 가진 체인을 프리미엄 판단이 읽는 모양으로 보여 준다
export class InMemoryStoreEntitlementReader extends StoreEntitlementReaderPort {
  readonly #subscriptions: Pick<InMemorySubscriptionRepository, "all">;

  constructor(subscriptions: Pick<InMemorySubscriptionRepository, "all">) {
    super();
    this.#subscriptions = subscriptions;
  }

  async listByUserId(userId: UserId): Promise<StoreSubscriptionEntitlement[]> {
    return this.#subscriptions.all
      .filter((subscription) => subscription.userId.equals(userId))
      .map((subscription) => {
        const primitives = subscription.toPrimitives();
        return {
          storeSubscriptionId: primitives.storeSubscriptionId,
          productId: primitives.productId,
          startedAt: primitives.startedAt,
          status: primitives.status,
          expiresAt: primitives.expiresAt,
          gracePeriodEndsAt: primitives.gracePeriodEndsAt,
          periodType: primitives.periodType,
        };
      });
  }
}
