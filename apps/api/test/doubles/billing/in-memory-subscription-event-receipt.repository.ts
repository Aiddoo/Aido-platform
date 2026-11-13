import { SubscriptionEventReceiptRepositoryPort } from "#api/modules/billing/subscriptions/application/ports/subscription-event-receipt.repository.port";
import type {
  SubscriptionEventReceipt,
  SubscriptionEventReceiptPrimitives,
} from "#api/modules/billing/subscriptions/domain/subscription-event-receipt.entity";

export class InMemorySubscriptionEventReceiptRepository extends SubscriptionEventReceiptRepositoryPort {
  readonly receipts = new Map<string, SubscriptionEventReceiptPrimitives>();

  async claim(receipt: SubscriptionEventReceipt): Promise<boolean> {
    const primitives = receipt.toPrimitives();
    const key = `${primitives.provider}:${primitives.eventId}`;
    if (this.receipts.has(key)) {
      return false;
    }
    this.receipts.set(key, primitives);
    return true;
  }
}
