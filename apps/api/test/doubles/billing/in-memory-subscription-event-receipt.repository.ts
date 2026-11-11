import {
  type ClaimSubscriptionEventReceiptInput,
  SubscriptionEventReceiptRepositoryPort,
} from "#api/modules/billing/subscriptions/application/ports/subscription-event-receipt.repository.port";

export class InMemorySubscriptionEventReceiptRepository extends SubscriptionEventReceiptRepositoryPort {
  readonly receipts = new Map<string, ClaimSubscriptionEventReceiptInput>();

  async claim(input: ClaimSubscriptionEventReceiptInput): Promise<boolean> {
    if (this.receipts.has(input.eventId)) {
      return false;
    }
    this.receipts.set(input.eventId, input);
    return true;
  }
}
