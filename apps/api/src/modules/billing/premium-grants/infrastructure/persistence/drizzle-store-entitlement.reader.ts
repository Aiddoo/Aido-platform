import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { StoreSubscriptionEntitlement } from "../../../shared/premium-access.domain-service.js";
import { toStorePeriodType } from "../../../subscriptions/domain/subscription-lifecycle.domain-service.js";
import { StoreEntitlementReaderPort } from "../../application/ports/store-entitlement.reader.port.js";

@Injectable()
export class DrizzleStoreEntitlementReader extends StoreEntitlementReaderPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    super();
    this.#txHost = txHost;
  }

  async listByUserId(userId: UserId): Promise<StoreSubscriptionEntitlement[]> {
    const rows = await this.#txHost.tx.query.subscription.findMany({
      columns: {
        revenueCatId: true,
        productId: true,
        startedAt: true,
        status: true,
        expiresAt: true,
        gracePeriodEndsAt: true,
        periodType: true,
      },
      where: { userId: userId.value, deletedAt: { isNull: true } },
    });
    return rows.map(({ revenueCatId, periodType, ...row }) => ({
      ...row,
      storeSubscriptionId: revenueCatId,
      periodType: toStorePeriodType(periodType),
    }));
  }
}
