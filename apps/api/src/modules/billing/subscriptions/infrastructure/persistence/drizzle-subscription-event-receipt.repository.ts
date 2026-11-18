import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { subscriptionEventReceipt } from "#api/platform/database/schema/billing.schema";

import type { SubscriptionEventReceiptRepositoryPort } from "../../application/ports/subscription-event-receipt.repository.port.js";
import type { SubscriptionEventReceipt } from "../../domain/subscription-event-receipt.entity.js";
import { toSubscriptionEventReceiptRow } from "./subscription-event-receipt-row.mapper.js";

@Injectable()
export class DrizzleSubscriptionEventReceiptRepository implements SubscriptionEventReceiptRepositoryPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#transactionHost = transactionHost;
  }

  async claim(receipt: SubscriptionEventReceipt): Promise<boolean> {
    const inserted = await this.#transactionHost.tx
      .insert(subscriptionEventReceipt)
      .values(toSubscriptionEventReceiptRow(receipt))
      .onConflictDoNothing({
        target: [subscriptionEventReceipt.provider, subscriptionEventReceipt.eventId],
      })
      .returning({ eventId: subscriptionEventReceipt.eventId });
    return inserted.length === 1;
  }
}
