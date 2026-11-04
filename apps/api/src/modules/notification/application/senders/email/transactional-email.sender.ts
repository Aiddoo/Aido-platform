import { randomUUID } from "node:crypto";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import { resolveEmailPriority } from "../../../domain/policies/email/email-budget.policy.js";
import type { EmailMessage } from "../../../domain/value-objects/email/email-message.vo.js";
import { EmailDeliveryLogEvent } from "../../observability/email/email-log.events.js";
import { type EmailBudgetPort } from "../../ports/email/email-budget.port.js";
import { type EmailDeliveryQueuePort } from "../../ports/email/email-delivery-queue.port.js";
import {
  createInquiryEmail,
  createPasswordResetEmail,
  createPasswordSetupEmail,
  createUserReportEmail,
  createVerificationCodeEmail,
} from "../../services/email/email-message.factory.js";
import type { InquiryTemplateData } from "../../templates/email/inquiry.template.js";
import type { PasswordResetTemplateData } from "../../templates/email/password-reset.template.js";
import type { PasswordSetupTemplateData } from "../../templates/email/password-setup.template.js";
import type { UserReportTemplateData } from "../../templates/email/user-report.template.js";
import type { VerificationCodeTemplateData } from "../../templates/email/verification-code.template.js";

/**
 * 발송 요청의 결과. queued는 발송 큐에 담았다는 뜻이고 실제 발송은 비동기로 끝난다.
 * 재시도·최종 실패 처리는 발송 큐(worker)가 맡으므로 호출자는 이 결과로 재시도하지 않는다.
 */
export type EmailDispatch =
  | { readonly status: "queued" }
  | { readonly status: "rejected"; readonly reason: "budget_exhausted" | "queue_unavailable" };

interface TransactionalEmailSenderDependencies {
  readonly queue: EmailDeliveryQueuePort;
  readonly budget: Pick<EmailBudgetPort, "reserve" | "release">;
  readonly logger: Pick<ApplicationLogger, "log" | "warn">;
}

/** 인증·문의·신고 템플릿을 이메일 발송 큐에 올리는 공개 capability. */
export class TransactionalEmailSender {
  readonly #dependencies: TransactionalEmailSenderDependencies;

  constructor(dependencies: TransactionalEmailSenderDependencies) {
    this.#dependencies = dependencies;
  }

  sendVerificationCode(
    to: string,
    data: VerificationCodeTemplateData,
    idempotencyKey?: string,
  ): Promise<EmailDispatch> {
    return this.#dispatch(createVerificationCodeEmail(to, data, idempotencyKey));
  }

  sendPasswordResetCode(
    to: string,
    data: PasswordResetTemplateData,
    idempotencyKey?: string,
  ): Promise<EmailDispatch> {
    return this.#dispatch(createPasswordResetEmail(to, data, idempotencyKey));
  }

  sendPasswordSetupCode(
    to: string,
    data: PasswordSetupTemplateData,
    idempotencyKey?: string,
  ): Promise<EmailDispatch> {
    return this.#dispatch(createPasswordSetupEmail(to, data, idempotencyKey));
  }

  sendInquiry(to: string, data: InquiryTemplateData): Promise<EmailDispatch> {
    return this.#dispatch(createInquiryEmail(to, data));
  }

  sendUserReport(to: string, data: UserReportTemplateData): Promise<EmailDispatch> {
    return this.#dispatch(createUserReportEmail(to, data));
  }

  async #dispatch(message: EmailMessage): Promise<EmailDispatch> {
    const priority = resolveEmailPriority(message.kind);
    const reservation = await this.#dependencies.budget.reserve(priority);
    if (reservation === "exhausted") {
      this.#dependencies.logger.warn({
        event: EmailDeliveryLogEvent.DELIVERY_REJECTED,
        kind: message.kind,
        reason: "budget_exhausted",
      });
      return { status: "rejected", reason: "budget_exhausted" };
    }

    try {
      const enqueued = await this.#dependencies.queue.enqueue({
        deliveryId: message.idempotencyKey ?? randomUUID(),
        message,
      });
      if (enqueued === "duplicate") {
        await this.#dependencies.budget.release();
      }
    } catch {
      await this.#dependencies.budget.release();
      this.#dependencies.logger.warn({
        event: EmailDeliveryLogEvent.DELIVERY_REJECTED,
        kind: message.kind,
        reason: "queue_unavailable",
      });
      return { status: "rejected", reason: "queue_unavailable" };
    }

    this.#dependencies.logger.log({
      event: EmailDeliveryLogEvent.DELIVERY_QUEUED,
      kind: message.kind,
      priority,
    });
    return { status: "queued" };
  }
}
