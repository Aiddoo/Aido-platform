import { Logger } from "@nestjs/common";
import { Resend } from "resend";
import { match } from "ts-pattern";

import type { OutboundPolicy } from "#api/platform/resilience/outbound-policy";
import {
  OutboundRejectedError,
  OutboundTimeoutError,
} from "#api/platform/resilience/outbound-policy.errors";
import type { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import type {
  EmailDeliveryOutcome,
  EmailSenderPort,
} from "../../../application/ports/email/email-sender.port.js";
import type { EmailMessage } from "../../../domain/value-objects/email/email-message.vo.js";
import { EmailLogEvent } from "../../observability/email/email-log.events.js";
import { RESEND_POLICY } from "./email-outbound.policy.js";

type ResendErrorName = NonNullable<Awaited<ReturnType<Resend["emails"]["send"]>>["error"]>["name"];
type FailedOutcome = Extract<EmailDeliveryOutcome, { status: "failed" }>;

export interface ResendSettings {
  readonly apiKey: string | null;
  readonly from: string;
  readonly fromName: string;
  readonly environment: string;
}

const UNAVAILABLE: FailedOutcome = { status: "failed", reason: "unavailable", retryable: true };

/** Resend 오류 이름을 벤더 중립 실패로 옮긴다. 모르는 이름은 다시 보내도 소용없는 거절로 본다. */
function mapResendError(name: ResendErrorName): FailedOutcome {
  return match<ResendErrorName, FailedOutcome>(name)
    .with("rate_limit_exceeded", () => ({
      status: "failed",
      reason: "rate_limited",
      retryable: true,
    }))
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
    .with(
      "application_error",
      "internal_server_error",
      "concurrent_idempotent_requests",
      () => UNAVAILABLE,
    )
    .otherwise(() => ({ status: "failed", reason: "rejected", retryable: false }));
}

/** EmailSenderPort의 Resend 어댑터. 한 번만 시도하고 재시도는 큐에 맡긴다. */
export class ResendEmailSenderAdapter implements EmailSenderPort {
  readonly #logger = new Logger(ResendEmailSenderAdapter.name);
  readonly #resend: Resend | null;
  readonly #policy: OutboundPolicy;

  constructor(
    private readonly settings: ResendSettings,
    policies: OutboundPolicyRegistry,
  ) {
    this.#resend = settings.apiKey == null ? null : new Resend(settings.apiKey);
    this.#policy = policies.get(RESEND_POLICY);
  }

  async send(message: EmailMessage): Promise<EmailDeliveryOutcome> {
    const resend = this.#resend;
    if (resend == null) {
      return { status: "failed", reason: "not_configured", retryable: false };
    }

    const outcome = await this.#attempt(resend, message);
    if (outcome.status === "failed") {
      this.#logger.error({
        event: EmailLogEvent.DELIVERY_FAILED,
        reason: outcome.reason,
        retryable: outcome.retryable,
      });
    }
    return outcome;
  }

  async #attempt(resend: Resend, message: EmailMessage): Promise<EmailDeliveryOutcome> {
    try {
      return await this.#policy.execute(() => this.#sendOnce(resend, message));
    } catch (error) {
      if (!(error instanceof OutboundRejectedError || error instanceof OutboundTimeoutError)) {
        this.#logger.error({ event: EmailLogEvent.DELIVERY_FAILED, errorType: toErrorType(error) });
      }
      return UNAVAILABLE;
    }
  }

  async #sendOnce(resend: Resend, message: EmailMessage): Promise<EmailDeliveryOutcome> {
    const tagged = message.withTag({ name: "environment", value: this.settings.environment });
    const result = await resend.emails.send(
      {
        from: `${this.settings.fromName} <${this.settings.from}>`,
        to: tagged.to,
        subject: tagged.subject,
        html: tagged.html,
        text: tagged.text,
        tags: [...tagged.tags],
      },
      { idempotencyKey: tagged.idempotencyKey },
    );
    if (result.error != null) {
      return mapResendError(result.error.name);
    }
    return { status: "sent", providerMessageId: result.data.id };
  }
}
