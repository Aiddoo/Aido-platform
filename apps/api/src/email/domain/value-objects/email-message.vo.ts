import { ErrorCode } from "@aido/errors";
import { DomainException } from "@/shared/domain/exceptions/domain.exception";
import {
	getInquiryHtml,
	getInquirySubject,
	getInquiryText,
	type InquiryTemplateData,
} from "../templates/inquiry.template";
import {
	getPasswordResetHtml,
	getPasswordResetSubject,
	getPasswordResetText,
	type PasswordResetTemplateData,
} from "../templates/password-reset.template";
import {
	getPasswordSetupHtml,
	getPasswordSetupSubject,
	getPasswordSetupText,
	type PasswordSetupTemplateData,
} from "../templates/password-setup.template";
import {
	getVerificationCodeHtml,
	getVerificationCodeSubject,
	getVerificationCodeText,
	type VerificationCodeTemplateData,
} from "../templates/verification-code.template";

/** 이메일 태그 (추적/분류용) */
export interface EmailTag {
	name: string;
	value: string;
}

/** 이메일 타입 (태그용) */
export type EmailType =
	| "verification"
	| "password-reset"
	| "password-setup"
	| "notification"
	| "inquiry";

interface EmailMessageProps {
	to: string;
	subject: string;
	html: string;
	text: string;
	tags: readonly EmailTag[];
	idempotencyKey?: string;
}

/**
 * 발송할 이메일 메시지 — 도메인 값 객체.
 *
 * 각 이메일 종류(인증·비밀번호·문의)의 제목·본문·태그 조립과 불변식(수신자/제목이
 * 비어 있지 않음)을 캡슐화한다. 명명된 팩토리로만 생성되며 setter가 없다(불변).
 * 발신자(from)는 전송 어댑터가 붙이므로 포함하지 않는다.
 */
export class EmailMessage {
	private constructor(private readonly props: EmailMessageProps) {}

	get to(): string {
		return this.props.to;
	}

	get subject(): string {
		return this.props.subject;
	}

	get html(): string {
		return this.props.html;
	}

	get text(): string {
		return this.props.text;
	}

	get tags(): readonly EmailTag[] {
		return this.props.tags;
	}

	get idempotencyKey(): string | undefined {
		return this.props.idempotencyKey;
	}

	/** 이메일 인증 코드 */
	static verificationCode(
		to: string,
		data: VerificationCodeTemplateData,
		idempotencyKey?: string,
	): EmailMessage {
		return EmailMessage.create({
			to,
			subject: getVerificationCodeSubject(),
			html: getVerificationCodeHtml(data),
			text: getVerificationCodeText(data),
			tags: [{ name: "type", value: "verification" }],
			idempotencyKey,
		});
	}

	/** 비밀번호 재설정 코드 */
	static passwordReset(
		to: string,
		data: PasswordResetTemplateData,
		idempotencyKey?: string,
	): EmailMessage {
		return EmailMessage.create({
			to,
			subject: getPasswordResetSubject(),
			html: getPasswordResetHtml(data),
			text: getPasswordResetText(data),
			tags: [{ name: "type", value: "password-reset" }],
			idempotencyKey,
		});
	}

	/** 비밀번호 설정 코드 (소셜 전용 사용자용) */
	static passwordSetup(
		to: string,
		data: PasswordSetupTemplateData,
		idempotencyKey?: string,
	): EmailMessage {
		return EmailMessage.create({
			to,
			subject: getPasswordSetupSubject(),
			html: getPasswordSetupHtml(data),
			text: getPasswordSetupText(data),
			tags: [{ name: "type", value: "password-setup" }],
			idempotencyKey,
		});
	}

	/** 문의 전달 (담당자 수신) */
	static inquiry(to: string, data: InquiryTemplateData): EmailMessage {
		return EmailMessage.create({
			to,
			subject: getInquirySubject(data.categoryLabel),
			html: getInquiryHtml(data),
			text: getInquiryText(data),
			tags: [
				{ name: "type", value: "inquiry" },
				{ name: "category", value: data.category },
			],
		});
	}

	/**
	 * 태그를 추가한 새 인스턴스를 반환한다 (불변식 유지, 추적 태그 부착용).
	 */
	withTag(tag: EmailTag): EmailMessage {
		return new EmailMessage({ ...this.props, tags: [...this.props.tags, tag] });
	}

	/**
	 * 불변식을 검증하고 인스턴스를 생성한다.
	 *
	 * 수신자와 제목은 비어 있을 수 없다. 위반 시 DomainException(SYS_0002).
	 */
	private static create(props: EmailMessageProps): EmailMessage {
		if (props.to.trim().length === 0) {
			throw new DomainException(ErrorCode.SYS_0002, { field: "to" });
		}
		if (props.subject.trim().length === 0) {
			throw new DomainException(ErrorCode.SYS_0002, { field: "subject" });
		}
		return new EmailMessage(props);
	}
}
