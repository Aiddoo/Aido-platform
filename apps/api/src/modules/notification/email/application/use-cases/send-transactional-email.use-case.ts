import { randomUUID } from "node:crypto";

import { DEFAULT_LOCALE } from "@aido/api/vocabulary";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";

import { resolveEmailPriority } from "../../domain/email-budget.domain-service.js";
import type { EmailMessage } from "../../domain/email-message.vo.js";
import { toEmailMessage } from "../email-message.mapper.js";
import { EmailDeliveryLogEvent } from "../email.log-events.js";
import type { EmailBudgetPort } from "../ports/email-budget.port.js";
import type { EmailDeliveryQueuePort } from "../ports/email-delivery-queue.port.js";
import type { EmailSenderPort } from "../ports/email-sender.port.js";
import type {
  EmailTemplate,
  EmailTemplateRendererPort,
  InquiryTemplateData,
  PasswordResetTemplateData,
  PasswordSetupTemplateData,
  UserReportTemplateData,
  VerificationCodeTemplateData,
} from "../ports/email-template-renderer.port.js";

/**
 * 발송 요청의 결과. queued는 발송 큐에 담았다는 뜻이고 실제 발송은 비동기로 끝난다.
 * 재시도·최종 실패 처리는 발송 큐(worker)가 맡으므로 호출자는 이 결과로 재시도하지 않는다.
 */
export type EmailDispatch =
  | { readonly status: "queued" }
  | { readonly status: "rejected"; readonly reason: "budget_exhausted" | "queue_unavailable" };

/** 요청 안에서 보낸 결과. 보내지 못하면 호출자가 사용자에게 실패를 알려 다시 보내게 한다. */
export type EmailSendResult =
  | { readonly status: "sent" }
  | { readonly status: "rejected"; readonly reason: "budget_exhausted" | "delivery_failed" };

interface SendTransactionalEmailDependencies {
  readonly queue: Pick<EmailDeliveryQueuePort, "enqueue">;
  readonly sender: Pick<EmailSenderPort, "send">;
  readonly budget: Pick<EmailBudgetPort, "reserve" | "release" | "settleProviderQuotaExhausted">;
  readonly renderer: Pick<EmailTemplateRendererPort, "render">;
  readonly logger: Pick<ApplicationLoggerPort, "log" | "warn">;
}

/** 인증·문의·신고 템플릿을 이메일 발송 큐에 올리는 공개 capability. */
export class SendTransactionalEmailUseCase {
  readonly #dependencies: SendTransactionalEmailDependencies;

  constructor(dependencies: SendTransactionalEmailDependencies) {
    this.#dependencies = dependencies;
  }

  async sendVerificationCode(
    to: string,
    templateData: VerificationCodeTemplateData,
  ): Promise<EmailDispatch> {
    return this.#dispatch(await this.#compose(to, { kind: "verification", data: templateData }));
  }

  async sendPasswordResetCode(
    to: string,
    templateData: PasswordResetTemplateData,
  ): Promise<EmailDispatch> {
    return this.#dispatch(await this.#compose(to, { kind: "password-reset", data: templateData }));
  }

  async sendPasswordSetupCode(
    to: string,
    templateData: PasswordSetupTemplateData,
  ): Promise<EmailDispatch> {
    return this.#dispatch(await this.#compose(to, { kind: "password-setup", data: templateData }));
  }

  /**
   * 문의는 DB에 남지 않아 메일이 유일한 전달 경로다. 큐로 미루면 재시도를 다 쓴 문의가 말없이
   * 사라지므로 요청 안에서 한 번만 보내고, 실패는 그대로 돌려줘 사용자가 다시 보내게 한다.
   */
  async sendInquiry(to: string, templateData: InquiryTemplateData): Promise<EmailSendResult> {
    const message = await this.#compose(to, { kind: "inquiry", data: templateData });
    const reservation = await this.#dependencies.budget.reserve(resolveEmailPriority(message.kind));
    if (reservation === "exhausted") {
      this.#dependencies.logger.warn({
        event: EmailDeliveryLogEvent.DELIVERY_REJECTED,
        kind: message.kind,
        reason: "budget_exhausted",
      });
      return { status: "rejected", reason: "budget_exhausted" };
    }

    const outcome = await this.#dependencies.sender.send(message);
    if (outcome.status === "sent") {
      return { status: "sent" };
    }
    if (outcome.reason === "quota_exhausted") {
      await this.#dependencies.budget.settleProviderQuotaExhausted(outcome.scope);
    } else {
      await this.#dependencies.budget.release();
    }
    this.#dependencies.logger.warn({
      event: EmailDeliveryLogEvent.DELIVERY_REJECTED,
      kind: message.kind,
      reason: outcome.reason,
    });
    return { status: "rejected", reason: "delivery_failed" };
  }

  async sendUserReport(to: string, templateData: UserReportTemplateData): Promise<EmailDispatch> {
    return this.#dispatch(await this.#compose(to, { kind: "user-report", data: templateData }));
  }

  // 수신자 언어를 받기 전까지 출시 동작대로 모든 메일을 기본 언어(ko)로 렌더한다
  async #compose(to: string, template: EmailTemplate): Promise<EmailMessage> {
    const body = await this.#dependencies.renderer.render(template, DEFAULT_LOCALE);
    return toEmailMessage(to, template, body);
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
