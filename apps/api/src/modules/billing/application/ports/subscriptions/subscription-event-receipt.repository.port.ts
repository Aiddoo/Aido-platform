export interface ClaimSubscriptionEventReceiptInput {
  readonly eventId: string;
  readonly eventType: string;
  readonly processedAt: Date;
}

export interface SubscriptionEventReceiptRepositoryPort {
  claim(input: ClaimSubscriptionEventReceiptInput): Promise<boolean>;
}

export const SUBSCRIPTION_EVENT_RECEIPT_REPOSITORY = Symbol(
  "SUBSCRIPTION_EVENT_RECEIPT_REPOSITORY",
);
