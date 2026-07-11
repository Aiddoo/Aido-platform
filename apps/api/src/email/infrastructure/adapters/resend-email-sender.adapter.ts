import { Injectable, Logger } from "@nestjs/common";
import { Resend } from "resend";
import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";
import type {
	EmailSenderPort,
	EmailSendResult,
} from "../../application/ports/email-sender.port";
import type { EmailMessage } from "../../domain/value-objects/email-message.vo";
import {
	EMAIL_CONSTANTS,
	RETRYABLE_ERROR_TYPES,
} from "../constants/email.constants";

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
			this.#logger.warn(
				"Resend API key not configured. Emails will be logged only.",
			);
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
			this.#logger.debug(`[EMAIL MOCK] To: ${tagged.to}`);
			this.#logger.debug(`[EMAIL MOCK] Subject: ${tagged.subject}`);
			this.#logger.debug(
				`[EMAIL MOCK] IdempotencyKey: ${tagged.idempotencyKey || "none"}`,
			);
			this.#logger.debug(`[EMAIL MOCK] Tags: ${JSON.stringify(tagged.tags)}`);
			this.#logger.debug(`[EMAIL MOCK] Text:\n${tagged.text}`);

			return {
				success: true,
				messageId: `mock-${Date.now()}`,
				retryCount: 0,
			};
		}

		return this.#sendWithRetry(tagged);
	}

	/**
	 * 지수 백오프를 적용한 재시도 로직
	 */
	async #sendWithRetry(
		message: EmailMessage,
		attempt = 0,
	): Promise<EmailSendResult> {
		// #resend가 없으면 실패 반환 (이 메서드는 #resend가 있을 때만 호출됨)
		if (!this.#resend) {
			return {
				success: false,
				error: "Resend client not initialized",
				retryCount: attempt,
			};
		}

		const from = `${this.#fromName} <${this.#fromEmail}>`;

		try {
			const result = await this.#resend.emails.send({
				from,
				to: message.to,
				subject: message.subject,
				html: message.html,
				text: message.text,
				tags: [...message.tags],
				headers: message.idempotencyKey
					? { "Idempotency-Key": message.idempotencyKey }
					: undefined,
			});

			if (result.error) {
				// 재시도 가능한 에러인지 확인
				if (
					RETRYABLE_ERROR_TYPES.has(result.error.name) &&
					attempt < EMAIL_CONSTANTS.MAX_RETRIES
				) {
					const delay = this.#calculateBackoffDelay(attempt);
					this.#logger.warn(
						`Retryable error (${result.error.name}), retrying in ${delay}ms... (attempt ${attempt + 1}/${EMAIL_CONSTANTS.MAX_RETRIES})`,
					);
					await this.#sleep(delay);
					return this.#sendWithRetry(message, attempt + 1);
				}

				this.#logger.error(
					`Failed to send email to ${message.to}: ${result.error.message}`,
				);
				return {
					success: false,
					error: result.error.message,
					retryCount: attempt,
				};
			}

			this.#logger.log(
				`Email sent successfully to ${message.to} (ID: ${result.data?.id})`,
			);
			return {
				success: true,
				messageId: result.data?.id,
				retryCount: attempt,
			};
		} catch (error) {
			// 네트워크 에러 등 예외 발생 시 재시도
			if (attempt < EMAIL_CONSTANTS.MAX_RETRIES) {
				const delay = this.#calculateBackoffDelay(attempt);
				this.#logger.warn(
					`Network error, retrying in ${delay}ms... (attempt ${attempt + 1}/${EMAIL_CONSTANTS.MAX_RETRIES})`,
				);
				await this.#sleep(delay);
				return this.#sendWithRetry(message, attempt + 1);
			}

			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			this.#logger.error(
				`Failed to send email to ${message.to}: ${errorMessage}`,
			);

			return {
				success: false,
				error: errorMessage,
				retryCount: attempt,
			};
		}
	}

	/**
	 * 지수 백오프 딜레이 계산
	 * 시도 횟수에 따라 1초, 2초, 4초... 증가
	 */
	#calculateBackoffDelay(attempt: number): number {
		return EMAIL_CONSTANTS.BASE_RETRY_DELAY * 2 ** attempt;
	}

	/**
	 * 지정된 시간만큼 대기
	 */
	async #sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
