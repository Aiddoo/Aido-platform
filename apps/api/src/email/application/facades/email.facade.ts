import { Inject, Injectable } from "@nestjs/common";
import type { InquiryTemplateData } from "../../domain/templates/inquiry.template";
import type { PasswordResetTemplateData } from "../../domain/templates/password-reset.template";
import type { PasswordSetupTemplateData } from "../../domain/templates/password-setup.template";
import type { VerificationCodeTemplateData } from "../../domain/templates/verification-code.template";
import { EmailMessage } from "../../domain/value-objects/email-message.vo";
import {
	EMAIL_SENDER,
	type EmailSenderPort,
	type EmailSendResult,
} from "../ports/email-sender.port";

/**
 * 이메일 애플리케이션 서비스(Facade).
 *
 * 도메인 값 객체(EmailMessage)의 명명 팩토리로 메시지를 만들고 전송은 EMAIL_SENDER
 * 포트에 위임한다. 전송 벤더(Resend 등)나 재시도 전략은 이 계층이 알지 못한다 —
 * 어댑터가 소유한다. 컨트롤러가 없는 모듈이므로 inquiry·auth 등이 이 Facade를 주입한다.
 */
@Injectable()
export class EmailFacade {
	constructor(
		@Inject(EMAIL_SENDER)
		private readonly sender: EmailSenderPort,
	) {}

	/** 이메일 인증 코드 발송 */
	sendVerificationCode(
		to: string,
		data: VerificationCodeTemplateData,
		idempotencyKey?: string,
	): Promise<EmailSendResult> {
		return this.sender.send(
			EmailMessage.verificationCode(to, data, idempotencyKey),
		);
	}

	/** 비밀번호 재설정 코드 발송 */
	sendPasswordResetCode(
		to: string,
		data: PasswordResetTemplateData,
		idempotencyKey?: string,
	): Promise<EmailSendResult> {
		return this.sender.send(
			EmailMessage.passwordReset(to, data, idempotencyKey),
		);
	}

	/** 비밀번호 설정 인증 코드 발송 (소셜 전용 사용자용) */
	sendPasswordSetupCode(
		to: string,
		data: PasswordSetupTemplateData,
		idempotencyKey?: string,
	): Promise<EmailSendResult> {
		return this.sender.send(
			EmailMessage.passwordSetup(to, data, idempotencyKey),
		);
	}

	/** 문의 이메일 발송 (담당자 수신) */
	sendInquiry(to: string, data: InquiryTemplateData): Promise<EmailSendResult> {
		return this.sender.send(EmailMessage.inquiry(to, data));
	}
}
