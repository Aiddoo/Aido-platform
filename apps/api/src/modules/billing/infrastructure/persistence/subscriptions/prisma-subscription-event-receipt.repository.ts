import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import { encodeCreate } from "#api/platform/database/database-records";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";

import type {
  ClaimSubscriptionEventReceiptInput,
  SubscriptionEventReceiptRepositoryPort,
} from "../../../application/ports/subscriptions/subscription-event-receipt.repository.port.js";

const PROVIDER = "REVENUECAT";

@Injectable()
export class PrismaSubscriptionEventReceiptRepository implements SubscriptionEventReceiptRepositoryPort {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  async claim(input: ClaimSubscriptionEventReceiptInput): Promise<boolean> {
    const inserted = await this.txHost.tx.orm.public.SubscriptionEventReceipt.createAndCount(
      [
        encodeCreate("SubscriptionEventReceipt", {
          provider: PROVIDER,
          eventId: input.eventId,
          eventType: input.eventType,
          processedAt: input.processedAt,
        }),
      ],
      { onConflict: "skip", conflictOn: ["provider", "eventId"] },
    );
    return inserted === 1;
  }
}
