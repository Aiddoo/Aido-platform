import type { EmailPriority } from "../../domain/email-delivery.constants.js";
import type { EmailQuotaScope } from "./email-sender.port.js";

const EMAIL_BUDGET_RESERVATIONS = ["reserved", "exhausted"] as const;
export type EmailBudgetReservation = (typeof EMAIL_BUDGET_RESERVATIONS)[number];

/**
 * 이메일 발송 예산(무료 한도를 넘지 않게 하는 일·월 건수). 발송을 큐에 담을 때 예약하고,
 * 공급자에 못 보낸 채 끝나면 돌려준다. 예산 저장소 오류로 인증 메일을 막지 않도록 구현은
 * 계량이 실패하면 예약된 것으로 본다.
 */
export abstract class EmailBudgetPort {
  abstract reserve(priority: EmailPriority): Promise<EmailBudgetReservation>;
  abstract release(): Promise<void>;
  /** 공급자가 한도를 넘었다고 알려 왔으니 계량도 그 한도까지 맞추고 경보를 올린다. */
  abstract settleProviderQuotaExhausted(scope: EmailQuotaScope): Promise<void>;
}
