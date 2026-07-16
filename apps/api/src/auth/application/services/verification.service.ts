import { ErrorCode } from "@aido/errors";
import { VERIFICATION_CODE } from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { VerificationType } from "@/auth/domain/types";
import { VerificationCode } from "@/auth/domain/value-objects/verification-code.vo";
import {
	addMinutes,
	subtractSeconds,
} from "@/shared/domain/date/utils/arithmetic";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import {
	AUTH_EMAIL_SENDER,
	type AuthEmailSenderPort,
} from "../ports/auth-collaboration.port";
import {
	AUTH_VERIFICATION_REPOSITORY,
	type AuthVerificationRepositoryPort,
} from "../ports/auth-persistence.port";

export interface VerificationCodeResult {
	code: string;
	expiresAt: Date;
}

// 6자리 숫자 인증 코드 생성, 검증, 이메일 발송 (SHA-256 해시 저장, 최대 시도 횟수 제한, 재발송 쿨다운)
@Injectable()
export class VerificationService {
	readonly #logger = new Logger(VerificationService.name);

	constructor(
		@Inject(AUTH_VERIFICATION_REPOSITORY)
		private readonly verificationRepository: AuthVerificationRepositoryPort,
		@Inject(AUTH_EMAIL_SENDER)
		private readonly emailFacade: AuthEmailSenderPort,
	) {}

	// 트랜잭션 내부에서만 사용. 이메일 발송은 트랜잭션 후 sendVerificationEmail()로 별도 처리
	async createEmailVerification(
		userId: string,
	): Promise<VerificationCodeResult> {
		// 재발송 쿨다운 확인
		await this.#checkResendCooldown(userId, "EMAIL_VERIFY");

		// 기존 미사용 인증 코드 무효화
		await this.verificationRepository.invalidateAllByUserIdAndType(
			userId,
			"EMAIL_VERIFY",
		);

		// 새 인증 코드 생성
		const result = await this.#createVerificationCode(userId, "EMAIL_VERIFY");

		this.#logger.log(`Verification code created for user ${userId}`);
		return result;
	}

	// 이메일 발송 실패는 로그만 남기고 예외를 던지지 않음 (재발송 가능)
	async sendVerificationEmail(email: string, code: string): Promise<void> {
		const emailResult = await this.emailFacade.sendVerificationCode(email, {
			code,
			expiryMinutes: VERIFICATION_CODE.EXPIRY_MINUTES,
		});

		if (!emailResult.success) {
			this.#logger.error(
				`Failed to send verification email to ${email}: ${emailResult.error}`,
			);
			// 이메일 발송 실패해도 예외를 던지지 않음 (사용자는 재발송 가능)
		}
	}

	async createAndSendPasswordReset(
		userId: string,
		email: string,
	): Promise<VerificationCodeResult> {
		// 재발송 쿨다운 확인
		await this.#checkResendCooldown(userId, "PASSWORD_RESET");

		// 기존 미사용 인증 코드 무효화
		await this.verificationRepository.invalidateAllByUserIdAndType(
			userId,
			"PASSWORD_RESET",
		);

		// 새 인증 코드 생성
		const result = await this.#createVerificationCode(userId, "PASSWORD_RESET");

		// 이메일 발송
		const emailResult = await this.emailFacade.sendPasswordResetCode(email, {
			code: result.code,
			expiryMinutes: VERIFICATION_CODE.EXPIRY_MINUTES,
		});

		if (!emailResult.success) {
			this.#logger.error(
				`Failed to send password reset email to ${email}: ${emailResult.error}`,
			);
		}

		this.#logger.log(`Password reset code created for user ${userId}`);
		return result;
	}

	async createAndSendPasswordSetup(
		userId: string,
		email: string,
	): Promise<VerificationCodeResult> {
		// 재발송 쿨다운 확인
		await this.#checkResendCooldown(userId, "PASSWORD_SETUP");

		// 기존 미사용 인증 코드 무효화
		await this.verificationRepository.invalidateAllByUserIdAndType(
			userId,
			"PASSWORD_SETUP",
		);

		// 새 인증 코드 생성
		const result = await this.#createVerificationCode(userId, "PASSWORD_SETUP");

		// 이메일 발송
		const emailResult = await this.emailFacade.sendPasswordSetupCode(email, {
			code: result.code,
			expiryMinutes: VERIFICATION_CODE.EXPIRY_MINUTES,
		});

		if (!emailResult.success) {
			this.#logger.error(
				`Failed to send password setup email to ${email}: ${emailResult.error}`,
			);
		}

		this.#logger.log(`Password setup code created for user ${userId}`);
		return result;
	}

	// 브루트포스 보호: 최대 시도 횟수 초과 시 검증 거부, 실패 시 시도 횟수 증가
	async verifyCode(
		userId: string,
		code: string,
		type: VerificationType,
	): Promise<boolean> {
		// 해당 사용자의 유효한 인증 코드 조회 (시도 횟수 포함)
		const verification =
			await this.verificationRepository.findValidByUserIdAndType(userId, type);

		// 유효한 인증 코드가 없음
		if (!verification) {
			throw new ApplicationException(ErrorCode.VERIFY_0751);
		}

		// 브루트포스 보호: 최대 시도 횟수 초과 확인
		if (verification.attempts >= VERIFICATION_CODE.MAX_ATTEMPTS) {
			throw new ApplicationException(ErrorCode.VERIFY_0754);
		}

		const tokenHash = VerificationCode.hashOf(code);

		// 코드 일치 확인
		if (verification.token !== tokenHash) {
			// 실패 시 시도 횟수 증가 (트랜잭션 외부에서 수행하여 롤백 방지)
			// 브루트포스 보호를 위해 실패 횟수는 항상 영구 저장되어야 함
			await this.verificationRepository.incrementAttempts(verification.id);

			this.#logger.warn(
				`Verification attempt failed for user ${userId}, attempts: ${verification.attempts + 1}`,
			);

			throw new ApplicationException(ErrorCode.VERIFY_0751);
		}

		// 사용 처리
		await this.verificationRepository.markAsUsed(verification.id);

		this.#logger.log(`Verification code verified for user ${userId}`);
		return true;
	}

	async #checkResendCooldown(
		userId: string,
		type: VerificationType,
	): Promise<void> {
		const cooldownSince = subtractSeconds(
			VERIFICATION_CODE.RESEND_COOLDOWN_SECONDS,
		);

		const recentCount =
			await this.verificationRepository.countRecentByUserIdAndType(
				userId,
				type,
				cooldownSince,
			);

		if (recentCount > 0) {
			throw new ApplicationException(ErrorCode.VERIFY_0753, {
				remainingSeconds: VERIFICATION_CODE.RESEND_COOLDOWN_SECONDS,
			});
		}
	}

	async #createVerificationCode(
		userId: string,
		type: VerificationType,
	): Promise<VerificationCodeResult> {
		// 6자리 랜덤 숫자 생성 + SHA-256 해시(도메인 값 객체가 소유)
		const verificationCode = VerificationCode.generate();

		// 만료 시간 계산
		const expiresAt = addMinutes(VERIFICATION_CODE.EXPIRY_MINUTES);

		// DB에 저장 (해시된 토큰)
		await this.verificationRepository.create({
			userId,
			type,
			token: verificationCode.hash,
			expiresAt,
		});

		return { code: verificationCode.value, expiresAt };
	}
}
