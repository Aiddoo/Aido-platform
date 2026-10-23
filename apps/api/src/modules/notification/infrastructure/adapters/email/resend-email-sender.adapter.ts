import { Injectable, Logger } from "@nestjs/common";
import { retry } from "es-toolkit";
import { Resend } from "resend";

import { TypedConfigService } from "#api/platform/config/services/config.service";

import type {
  EmailSenderPort,
  EmailSendResult,
} from "../../../application/ports/email/email-sender.port.js";
import type { EmailMessage } from "../../../domain/value-objects/email/email-message.vo.js";
import { EMAIL_CONSTANTS, RETRYABLE_ERROR_TYPES } from "../../constants/email/email.constants.js";
import { EmailLogEvent } from "../../observability/email/email-log.events.js";

interface ResendFailure {
  readonly name: string;
  readonly message: string;
}

class ResendApiError extends Error {
  constructor(readonly failure: ResendFailure) {
    super(failure.message);
  }
}

/** Resend가 거절한 요청은 재시도 가능한 오류 타입일 때만, 네트워크 예외는 항상 재시도한다. */
function isRetryableSendFailure(error: unknown): boolean {
  return !(error instanceof ResendApiError) || RETRYABLE_ERROR_TYPES.has(error.failure.name);
}

/** 시도 횟수에 따라 1초, 2초, 4초... 증가하는 지수 백오프 대기 시간 */
function calculateBackoffDelay(attempt: number): number {
  return EMAIL_CONSTANTS.BASE_RETRY_DELAY * 2 ** attempt;
}

function toLoggedErrorType(failure: ResendFailure): string {
  return failure.name === "validation_error" || RETRYABLE_ERROR_TYPES.has(failure.name)
    ? failure.name
    : "RESEND_ERROR";
}

/**
 * EmailSenderPort의 Resend 어댑터.
 *
 * Production에서는 Resend API로 실제 발송하고, API 키 미설정(dev/test) 시 로그로
 * 대체한다. 지수 백오프 재시도·Idempotency 헤더·환경 태그 부착 등 트랜스포트
 * 관심사를 이 어댑터가 소유한다. 벤더를 바꾸려면 이 파일만 교체하면 된다.
 */
@Injectable()
export class ResendEmailSenderAdapter implements EmailSenderPort {
  readonly #logger = new Logger(ResendEmailSenderAdapter.name);
  readonly #resend: Resend | null;
  readonly #fromEmail: string;
  readonly #fromName: string;
  readonly #environment: string;

  constructor(private readonly configService: TypedConfigService) {
    const emailConfig = this.configService.email;

    if (emailConfig.isConfigured && emailConfig.apiKey) {
      this.#resend = new Resend(emailConfig.apiKey);
      this.#logger.log("Resend email service initialized");
    } else {
      this.#resend = null;
      this.#logger.warn("Resend API key not configured. Emails will be logged only.");
    }

    this.#fromEmail = emailConfig.from;
    this.#fromName = emailConfig.fromName;
    this.#environment = this.configService.nodeEnv;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    // 환경 태그를 부착한다 (Resend 대시보드 추적용)
    const tagged = message.withTag({
      name: "environment",
      value: this.#environment,
    });

    // API 키 미설정(dev/test)이면 로그만 출력
    if (!this.#resend) {
      this.#logger.debug({ event: EmailLogEvent.DELIVERY_SIMULATED });

      return {
        success: true,
        messageId: `mock-${Date.now()}`,
        retryCount: 0,
      };
    }

    return this.#sendWithRetry(this.#resend, tagged);
  }

  async #sendWithRetry(resend: Resend, message: EmailMessage): Promise<EmailSendResult> {
    let attemptCount = 0;

    try {
      const messageId = await retry(
        async () => {
          attemptCount += 1;
          return this.#sendOnce(resend, message);
        },
        {
          retries: EMAIL_CONSTANTS.MAX_RETRIES,
          shouldRetry: isRetryableSendFailure,
          delay: (attempt, error) => {
            const delayMs = calculateBackoffDelay(attempt);
            const reason =
              error instanceof ResendApiError
                ? `Retryable error (${error.failure.name})`
                : "Network error";
            this.#logger.warn(
              `${reason}, retrying in ${delayMs}ms... (attempt ${attempt + 1}/${EMAIL_CONSTANTS.MAX_RETRIES})`,
            );
            return delayMs;
          },
        },
      );

      const retryCount = attemptCount - 1;
      this.#logger.log({
        event: EmailLogEvent.DELIVERY_COMPLETED,
        messageId,
        retryCount,
      });
      return { success: true, messageId, retryCount };
    } catch (error) {
      const retryCount = attemptCount - 1;
      if (error instanceof ResendApiError) {
        this.#logger.error({
          event: EmailLogEvent.DELIVERY_FAILED,
          errorType: toLoggedErrorType(error.failure),
          retryCount,
        });
        return { success: false, error: error.failure.message, retryCount };
      }

      this.#logger.error({ event: EmailLogEvent.DELIVERY_FAILED, retryCount });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        retryCount,
      };
    }
  }

  async #sendOnce(resend: Resend, message: EmailMessage): Promise<string | undefined> {
    const result = await resend.emails.send(
      {
        from: `${this.#fromName} <${this.#fromEmail}>`,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        tags: [...message.tags],
      },
      { idempotencyKey: message.idempotencyKey },
    );

    if (result.error) {
      throw new ResendApiError(result.error);
    }
    return result.data?.id;
  }
}
