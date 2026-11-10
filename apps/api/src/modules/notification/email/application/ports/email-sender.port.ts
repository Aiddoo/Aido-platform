import type { EmailMessage } from "../../domain/email-message.vo.js";

/** EmailSenderPort DI 토큰 */
export const EMAIL_SENDER = Symbol("EMAIL_SENDER");

export type EmailQuotaScope = "daily" | "monthly";

export type EmailDeliveryOutcome =
  | { readonly status: "sent"; readonly providerMessageId: string | null }
  | {
      readonly status: "failed";
      readonly reason: "rate_limited" | "unavailable" | "rejected" | "not_configured";
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
 * 이메일 전송 포트(벤더 중립). 메시지 하나를 한 번 시도하고 결과를 값으로 돌려주며 던지지 않는다.
 *
 * 벤더 오류를 위 결과로 옮기는 일, 시도별 제한 시간·회로 같은 호출 보호, 멱등 키 전달은 어댑터가
 * 맡는다. 재시도는 호출하는 큐(pg-boss)의 몫이라 어댑터는 다시 시도하지 않는다. SES 같은 다른
 * 벤더는 어댑터 하나를 더해 바꾼다.
 */
export interface EmailSenderPort {
  send(message: EmailMessage): Promise<EmailDeliveryOutcome>;
}
