import type { SubscriptionEnvironment } from "@aido/api/vocabulary";

export interface ClaimSubscriptionEventReceiptInput {
  readonly eventId: string;
  readonly eventType: string;
  readonly processedAt: Temporal.Instant;
  /** 웹훅이 보내지 않으면 null(알 수 없음)이다. */
  readonly environment?: SubscriptionEnvironment | null;
}

export abstract class SubscriptionEventReceiptRepositoryPort {
  /** 처음 기록하면 true, 이미 처리한 이벤트면 false다. */
  abstract claim(input: ClaimSubscriptionEventReceiptInput): Promise<boolean>;
}
