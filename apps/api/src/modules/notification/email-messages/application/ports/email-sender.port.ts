import type { EmailMessage } from "../../domain/email-message.vo.js";

const EMAIL_QUOTA_SCOPES = ["daily", "monthly"] as const;
export type EmailQuotaScope = (typeof EMAIL_QUOTA_SCOPES)[number];

const EMAIL_DELIVERY_FAILURE_REASONS = [
  "rate_limited",
  "unavailable",
  "rejected",
  "not_configured",
] as const;
type EmailDeliveryFailureReason = (typeof EMAIL_DELIVERY_FAILURE_REASONS)[number];

export type EmailDeliveryOutcome =
  | { readonly status: "sent"; readonly providerMessageId: string | null }
  | {
      readonly status: "failed";
      readonly reason: EmailDeliveryFailureReason;
      /** 같은 메시지를 다시 보내면 성공할 수 있는 실패인지 */
      readonly retryable: boolean;
    }
  | {
      readonly status: "failed";
      readonly reason: "quota_exhausted";
      readonly retryable: false;
      readonly scope: EmailQuotaScope;
    };

/**
 * 이메일 전송 포트(공급자 중립). 메시지 하나를 한 번 시도하고 결과를 값으로 돌려주며 던지지 않는다.
 * 재시도는 호출하는 큐(pg-boss)의 몫이라 어댑터는 다시 시도하지 않는다. 공급자 멱등 키는 message.idempotencyKey다.
 */
export abstract class EmailSenderPort {
  abstract send(message: EmailMessage): Promise<EmailDeliveryOutcome>;
}
