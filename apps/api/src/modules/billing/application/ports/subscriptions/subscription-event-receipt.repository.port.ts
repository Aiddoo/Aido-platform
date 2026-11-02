import type { SubscriptionEnvironment } from "@aido/api/vocabulary";

export interface ClaimSubscriptionEventReceiptInput {
  readonly eventId: string;
  readonly eventType: string;
  readonly processedAt: Date;
  /** 웹훅이 보내지 않으면 null(알 수 없음)이다. */
  readonly environment?: SubscriptionEnvironment | null;
}

export interface SubscriptionEventReceiptRepositoryPort {
  claim(input: ClaimSubscriptionEventReceiptInput): Promise<boolean>;
}

export const SUBSCRIPTION_EVENT_RECEIPT_REPOSITORY = Symbol(
  "SUBSCRIPTION_EVENT_RECEIPT_REPOSITORY",
);
