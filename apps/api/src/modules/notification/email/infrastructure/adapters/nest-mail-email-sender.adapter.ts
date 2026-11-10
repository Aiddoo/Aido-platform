import type { SupportedLocale } from "@aido/api/vocabulary";
import { Logger } from "@nestjs/common";
import { MailError, MailProviderError, type Mailer } from "@nestjs/mail";
import { match } from "ts-pattern";

import type { OutboundPolicy } from "#api/platform/resilience/outbound-policy";
import {
  OutboundRejectedError,
  OutboundTimeoutError,
} from "#api/platform/resilience/outbound-policy.errors";
import type { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import {
  EmailSenderPort,
  type EmailDeliveryOutcome,
} from "../../application/ports/email-sender.port.js";
import type {
  EmailTemplate,
  EmailTemplateRendererPort,
  RenderedEmail,
} from "../../application/ports/email-template-renderer.port.js";
import type { EmailMessage } from "../../domain/email-message.vo.js";
import { EMAIL_PROVIDER_POLICY } from "./email-outbound.policy.js";
import { EmailLogEvent } from "./email-provider.log-events.js";
import { toEmailTemplateView } from "./email-template.mapper.js";

type FailedOutcome = Extract<EmailDeliveryOutcome, { status: "failed" }>;

const UNAVAILABLE: FailedOutcome = { status: "failed", reason: "unavailable", retryable: true };
const RATE_LIMITED: FailedOutcome = { status: "failed", reason: "rate_limited", retryable: true };
const REJECTED: FailedOutcome = { status: "failed", reason: "rejected", retryable: false };
const HTTP_TOO_MANY_REQUESTS = 429;

/** 패키지 오류를 공급자 중립 실패로 옮긴다. 한도 초과는 Resend 오류 이름으로만 알 수 있다. */
function toFailedOutcome(error: MailError): FailedOutcome {
  const providerCode = error instanceof MailProviderError ? error.providerCode : undefined;
  return match<string | undefined, FailedOutcome>(providerCode)
    .with("daily_quota_exceeded", () => ({
      status: "failed",
      reason: "quota_exhausted",
      retryable: false,
      scope: "daily",
    }))
    .with("monthly_quota_exceeded", () => ({
      status: "failed",
      reason: "quota_exhausted",
      retryable: false,
      scope: "monthly",
    }))
    .otherwise(() => {
      if (error.code === HTTP_TOO_MANY_REQUESTS) {
        return RATE_LIMITED;
      }
      return error.permanent ? REJECTED : UNAVAILABLE;
    });
}

interface NestMailEmailSenderDependencies {
  readonly mailer: Pick<Mailer, "send" | "render">;
  readonly policies: Pick<OutboundPolicyRegistry, "get">;
  /** 공급자 키가 없으면 보내지 않고 not_configured로 끝낸다 */
  readonly isConfigured: boolean;
}

/**
 * `@nestjs/mail`을 쓰는 유일한 어댑터. 템플릿 파일 렌더와 공급자 전송을 맡는다.
 * 재시도는 pg-boss `email-delivery.v1` 한 층에만 두어 Mailer 재시도는 끈다(retry: false).
 */
export class NestMailEmailSenderAdapter
  extends EmailSenderPort
  implements EmailTemplateRendererPort
{
  readonly #logger = new Logger(NestMailEmailSenderAdapter.name);
  readonly #mailer: Pick<Mailer, "send" | "render">;
  readonly #policy: OutboundPolicy;
  readonly #isConfigured: boolean;

  constructor(dependencies: NestMailEmailSenderDependencies) {
    super();
    this.#mailer = dependencies.mailer;
    this.#policy = dependencies.policies.get(EMAIL_PROVIDER_POLICY);
    this.#isConfigured = dependencies.isConfigured;
  }

  // 옛 TS 템플릿의 trim()과 같게 파일 끝 줄바꿈을 걷는다
  async render(template: EmailTemplate, locale: SupportedLocale): Promise<RenderedEmail> {
    const view = toEmailTemplateView(template, locale);
    const message = await this.#mailer.render({
      subject: view.subject,
      template: view.name,
      context: view.context,
      locale,
    });
    return {
      subject: message.subject,
      html: (message.html ?? "").trim(),
      text: (message.text ?? "").trim(),
    };
  }

  async send(message: EmailMessage): Promise<EmailDeliveryOutcome> {
    if (!this.#isConfigured) {
      return { status: "failed", reason: "not_configured", retryable: false };
    }

    const outcome = await this.#attempt(message);
    if (outcome.status === "failed") {
      this.#logger.error({
        event: EmailLogEvent.DELIVERY_FAILED,
        reason: outcome.reason,
        retryable: outcome.retryable,
      });
    }
    return outcome;
  }

  async #attempt(message: EmailMessage): Promise<EmailDeliveryOutcome> {
    try {
      return await this.#policy.execute((signal) => this.#sendOnce(message, signal));
    } catch (error) {
      if (!(error instanceof OutboundRejectedError || error instanceof OutboundTimeoutError)) {
        this.#logger.error({ event: EmailLogEvent.DELIVERY_FAILED, errorType: toErrorType(error) });
      }
      return UNAVAILABLE;
    }
  }

  async #sendOnce(message: EmailMessage, signal: AbortSignal): Promise<EmailDeliveryOutcome> {
    try {
      const result = await this.#mailer.send({
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        retry: false,
        signal,
        ...(message.idempotencyKey != null && { idempotencyKey: message.idempotencyKey }),
      });
      return { status: "sent", providerMessageId: result.providerMessageId ?? null };
    } catch (error) {
      if (error instanceof MailError) {
        return toFailedOutcome(error);
      }
      throw error;
    }
  }
}
