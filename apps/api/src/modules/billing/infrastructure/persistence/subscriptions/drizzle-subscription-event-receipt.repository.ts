import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { subscriptionEventReceipt } from "#api/platform/database/schema/index";

import type {
  ClaimSubscriptionEventReceiptInput,
  SubscriptionEventReceiptRepositoryPort,
} from "../../../application/ports/subscriptions/subscription-event-receipt.repository.port.js";

const PROVIDER = "REVENUECAT";

@Injectable()
export class DrizzleSubscriptionEventReceiptRepository implements SubscriptionEventReceiptRepositoryPort {
  constructor(private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>) {}

  async claim(input: ClaimSubscriptionEventReceiptInput): Promise<boolean> {
    const inserted = await this.txHost.tx
      .insert(subscriptionEventReceipt)
      .values({
        provider: PROVIDER,
        eventId: input.eventId,
        eventType: input.eventType,
        processedAt: input.processedAt,
      })
      .onConflictDoNothing({
        target: [subscriptionEventReceipt.provider, subscriptionEventReceipt.eventId],
      })
      .returning({ eventId: subscriptionEventReceipt.eventId });
    return inserted.length === 1;
  }
}
