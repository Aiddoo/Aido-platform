import type { EmailKind } from "../domain/email-delivery.constants.js";

/** 다시 시도하면 보낼 수 있는 실패. 큐가 backoff로 다시 부른다. */
export class EmailDeliveryRetryableError extends Error {
  readonly kind: EmailKind;
  readonly reason: string;

  constructor(kind: EmailKind, reason: string) {
    super(`Email delivery failed: ${kind} ${reason}`);
    this.kind = kind;
    this.reason = reason;
    this.name = EmailDeliveryRetryableError.name;
  }
}

export function emailDeliveryRetryable(
  kind: EmailKind,
  reason: string,
): EmailDeliveryRetryableError {
  return new EmailDeliveryRetryableError(kind, reason);
}
