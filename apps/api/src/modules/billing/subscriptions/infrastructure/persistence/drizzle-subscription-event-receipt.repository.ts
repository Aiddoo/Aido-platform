import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { subscriptionEventReceipt } from "#api/platform/database/schema/billing.schema";

import {
  type ClaimSubscriptionEventReceiptInput,
  SubscriptionEventReceiptRepositoryPort,
} from "../../application/ports/subscription-event-receipt.repository.port.js";

const PROVIDER = "REVENUECAT";

@Injectable()
export class DrizzleSubscriptionEventReceiptRepository extends SubscriptionEventReceiptRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    super();
    this.#txHost = txHost;
  }

  async claim(input: ClaimSubscriptionEventReceiptInput): Promise<boolean> {
    const inserted = await this.#txHost.tx
      .insert(subscriptionEventReceipt)
      .values({
        provider: PROVIDER,
        eventId: input.eventId,
        eventType: input.eventType,
        processedAt: input.processedAt,
        environment: input.environment,
      })
      .onConflictDoNothing({
        target: [subscriptionEventReceipt.provider, subscriptionEventReceipt.eventId],
      })
      .returning({ eventId: subscriptionEventReceipt.eventId });
    return inserted.length === 1;
  }
}
