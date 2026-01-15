import { Injectable, Logger } from "@nestjs/common";
import { Resend } from "resend";
import { TypedConfigService } from "../../common/config/services/config.service";
import { EMAIL_CONSTANTS } from "./constants/email.constants";
import {
	getPasswordResetHtml,
	getPasswordResetSubject,
	getPasswordResetText,
	type PasswordResetTemplateData,
} from "./templates/password-reset.template";
import {
	getVerificationCodeHtml,
	getVerificationCodeSubject,
	getVerificationCodeText,
	type VerificationCodeTemplateData,
} from "./templates/verification-code.template";
import type { EmailSendOptions, EmailSendResult } from "./types/email.types";

/**
 * 이메일 발송 서비스 (Resend 통합)
 *
 * Production 환경에서는 Resend API를 통해 실제 이메일을 발송하고,
 * Development/Test 환경에서는 로그로 대체합니다.
 *
 * 주요 기능:
 * - 지수 백오프를 적용한 자동 재시도
 * - Idempotency Key를 통한 중복 발송 방지
 * - Tags를 통한 이메일 추적 및 분류
 */
@Injectable()
export class EmailService {
	private readonly _logger = new Logger(EmailService.name);
	private readonly _resend: Resend | null;
	private readonly _fromEmail: string;
	private readonly _fromName: string;
	private readonly _environment: string;

	constructor(private readonly _configService: TypedConfigService) {
		const emailConfig = this._configService.email;

		if (emailConfig.isConfigured && emailConfig.apiKey) {
			this._resend = new Resend(emailConfig.apiKey);
			this._logger.log("Resend email service initialized");
		} else {
			this._resend = null;
			this._logger.warn(
				"Resend API key not configured. Emails will be logged only.",
			);
		}

		this._fromEmail = emailConfig.from;
		this._fromName = emailConfig.fromName;
		this._environment = process.env.NODE_ENV || "development";
	}

	/**
	 * 이메일 인증 코드 발송
	 *
	 * @param to 수신자 이메일
	 * @param data 템플릿 데이터 (code, expiryMinutes)
	 * @param idempotencyKey 중복 발송 방지 키 (선택)
	 */
	async sendVerificationCode(
		to: string,
		data: VerificationCodeTemplateData,
		idempotencyKey?: string,
	): Promise<EmailSendResult> {
		const subject = getVerificationCodeSubject();
		const html = getVerificationCodeHtml(data);
		const text = getVerificationCodeText(data);

		return this._sendEmail({
			to,
			subject,
			html,
			text,
			idempotencyKey,
			tags: [
				{ name: "type", value: "verification" },
				{ name: "environment", value: this._environment },
			],
		});
	}

	/**
	 * 비밀번호 재설정 코드 발송
	 *
	 * @param to 수신자 이메일
	 * @param data 템플릿 데이터 (code, expiryMinutes)
	 * @param idempotencyKey 중복 발송 방지 키 (선택)
	 */
	async sendPasswordResetCode(
		to: string,
		data: PasswordResetTemplateData,
		idempotencyKey?: string,
	): Promise<EmailSendResult> {
		const subject = getPasswordResetSubject();
		const html = getPasswordResetHtml(data);
		const text = getPasswordResetText(data);

		return this._sendEmail({
			to,
			subject,
			html,
			text,
			idempotencyKey,
			tags: [
				{ name: "type", value: "password-reset" },
				{ name: "environment", value: this._environment },
			],
		});
	}

	/**
	 * 기본 이메일 발송
	 */
	private async _sendEmail(
		options: EmailSendOptions,
	): Promise<EmailSendResult> {
		// Development/Test 환경이거나 Resend가 설정되지 않은 경우 로그만 출력
		if (!this._resend) {
			this._logger.debug(`[EMAIL MOCK] To: ${options.to}`);
			this._logger.debug(`[EMAIL MOCK] Subject: ${options.subject}`);
			this._logger.debug(
				`[EMAIL MOCK] IdempotencyKey: ${options.idempotencyKey || "none"}`,
			);
			this._logger.debug(`[EMAIL MOCK] Tags: ${JSON.stringify(options.tags)}`);
			this._logger.debug(`[EMAIL MOCK] Text:\n${options.text}`);

			return {
				success: true,
				messageId: `mock-${Date.now()}`,
				retryCount: 0,
			};
		}

		return this._sendWithRetry(options);
	}

	/**
	 * 지수 백오프를 적용한 재시도 로직
	 *
	 * @param options 이메일 발송 옵션
	 * @param attempt 현재 시도 횟수 (0부터 시작)
	 */
	private async _sendWithRetry(
		options: EmailSendOptions,
		attempt = 0,
	): Promise<EmailSendResult> {
		// _resend가 없으면 실패 반환 (이 메서드는 _resend가 있을 때만 호출됨)
		if (!this._resend) {
			return {
				success: false,
				error: "Resend client not initialized",
				retryCount: attempt,
			};
		}

		const from = `${this._fromName} <${this._fromEmail}>`;

		try {
			const result = await this._resend.emails.send({
				from,
				to: options.to,
				subject: options.subject,
				html: options.html,
				text: options.text,
				tags: options.tags,
				headers: options.idempotencyKey
					? { "Idempotency-Key": options.idempotencyKey }
					: undefined,
			});

			if (result.error) {
				// 재시도 가능한 에러인지 확인
				if (
					this._isRetryableError(result.error) &&
					attempt < EMAIL_CONSTANTS.MAX_RETRIES
				) {
					const delay = this._calculateBackoffDelay(attempt);
					this._logger.warn(
						`Retryable error (${result.error.name}), retrying in ${delay}ms... (attempt ${attempt + 1}/${EMAIL_CONSTANTS.MAX_RETRIES})`,
					);
					await this._sleep(delay);
					return this._sendWithRetry(options, attempt + 1);
				}

				this._logger.error(
					`Failed to send email to ${options.to}: ${result.error.message}`,
				);
				return {
					success: false,
					error: result.error.message,
					retryCount: attempt,
				};
			}

			this._logger.log(
				`Email sent successfully to ${options.to} (ID: ${result.data?.id})`,
			);
			return {
				success: true,
				messageId: result.data?.id,
				retryCount: attempt,
			};
		} catch (error) {
			// 네트워크 에러 등 예외 발생 시 재시도
			if (attempt < EMAIL_CONSTANTS.MAX_RETRIES) {
				const delay = this._calculateBackoffDelay(attempt);
				this._logger.warn(
					`Network error, retrying in ${delay}ms... (attempt ${attempt + 1}/${EMAIL_CONSTANTS.MAX_RETRIES})`,
				);
				await this._sleep(delay);
				return this._sendWithRetry(options, attempt + 1);
			}

			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			this._logger.error(
				`Failed to send email to ${options.to}: ${errorMessage}`,
			);

			return {
				success: false,
				error: errorMessage,
				retryCount: attempt,
			};
		}
	}

	/**
	 * 재시도 가능한 에러인지 확인
	 */
	private _isRetryableError(error: { name: string }): boolean {
		return (
			EMAIL_CONSTANTS.RETRYABLE_ERROR_TYPES as readonly string[]
		).includes(error.name);
	}

	/**
	 * 지수 백오프 딜레이 계산
	 * 시도 횟수에 따라 1초, 2초, 4초... 증가
	 */
	private _calculateBackoffDelay(attempt: number): number {
		return EMAIL_CONSTANTS.BASE_RETRY_DELAY * 2 ** attempt;
	}

	/**
	 * 지정된 시간만큼 대기
	 */
	private _sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
