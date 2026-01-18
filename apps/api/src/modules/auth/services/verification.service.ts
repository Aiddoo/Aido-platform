import { createHash, randomInt } from "node:crypto";
import { VERIFICATION_CODE } from "@aido/validators";
import { Injectable, Logger } from "@nestjs/common";
import { addMinutes, subtractSeconds } from "@/common/date";
import { BusinessExceptions } from "@/common/exception/services/business-exception.service";
import type { Prisma, VerificationType } from "@/generated/prisma/client";
import { EmailService } from "@/modules/email/email.service";
import { VerificationRepository } from "../repositories/verification.repository";

/**
 * 인증 코드 생성 결과
 */
export interface VerificationCodeResult {
	/** 평문 인증 코드 (이메일로 발송) */
	code: string;
	/** 만료 시간 */
	expiresAt: Date;
}

/**
 * 인증 서비스
 *
 * 6자리 숫자 인증 코드 생성, 검증, 이메일 발송을 담당합니다.
 * - SHA-256 해시로 코드 저장 (보안)
 * - 최대 시도 횟수 제한
 * - 재발송 쿨다운 적용
 */
@Injectable()
export class VerificationService {
	private readonly logger = new Logger(VerificationService.name);

	constructor(
		private readonly verificationRepository: VerificationRepository,
		private readonly emailService: EmailService,
	) {}

	/**
	 * 이메일 인증 코드 생성 (트랜잭션 내부에서만 사용)
	 *
	 * 이 메서드는 DB 트랜잭션 내부에서 호출되어 Verification 레코드만 생성합니다.
	 * 이메일 발송은 트랜잭션 후에 sendVerificationEmail()로 별도 처리합니다.
	 */
	async createEmailVerification(
		userId: string,
		tx: Prisma.TransactionClient,
	): Promise<VerificationCodeResult> {
		// 재발송 쿨다운 확인
		await this._checkResendCooldown(userId, "EMAIL_VERIFY", tx);

		// 기존 미사용 인증 코드 무효화
		await this.verificationRepository.invalidateAllByUserIdAndType(
			userId,
			"EMAIL_VERIFY",
			tx,
		);

		// 새 인증 코드 생성
		const result = await this._createVerificationCode(
			userId,
			"EMAIL_VERIFY",
			tx,
		);

		this.logger.log(`Verification code created for user ${userId}`);
		return result;
	}

	/**
	 * 이메일 인증 코드 발송 (트랜잭션 외부)
	 *
	 * 이메일 발송 실패는 로그만 남기고 예외를 던지지 않습니다.
	 * 사용자는 resendVerification()을 통해 재발송할 수 있습니다.
	 */
	async sendVerificationEmail(email: string, code: string): Promise<void> {
		const emailResult = await this.emailService.sendVerificationCode(email, {
			code,
			expiryMinutes: VERIFICATION_CODE.EXPIRY_MINUTES,
		});

		if (!emailResult.success) {
			this.logger.error(
				`Failed to send verification email to ${email}: ${emailResult.error}`,
			);
			// 이메일 발송 실패해도 예외를 던지지 않음 (사용자는 재발송 가능)
		}
	}

	/**
	 * 이메일 인증 코드 생성 및 발송 (호환성 유지)
	 *
	 * @deprecated 새 코드는 createEmailVerification() + sendVerificationEmail()을 분리해서 사용해주세요.
	 * 이 메서드는 트랜잭션 경계를 무시하고 이메일 발송을 시도하므로 가능한 분리 메서드를 사용해주세요.
	 */
	async createAndSendEmailVerification(
		userId: string,
		email: string,
		tx?: Prisma.TransactionClient,
	): Promise<VerificationCodeResult> {
		// 재발송 쿨다운 확인
		await this._checkResendCooldown(userId, "EMAIL_VERIFY", tx);

		// 기존 미사용 인증 코드 무효화
		await this.verificationRepository.invalidateAllByUserIdAndType(
			userId,
			"EMAIL_VERIFY",
			tx,
		);

		// 새 인증 코드 생성
		const result = await this._createVerificationCode(
			userId,
			"EMAIL_VERIFY",
			tx,
		);

		// 이메일 발송 (트랜잭션 외부에서 실행)
		await this.sendVerificationEmail(email, result.code);

		this.logger.log(`Verification code created for user ${userId}`);
		return result;
	}

	/**
	 * 비밀번호 재설정 코드 생성 및 발송
	 */
	async createAndSendPasswordReset(
		userId: string,
		email: string,
		tx?: Prisma.TransactionClient,
	): Promise<VerificationCodeResult> {
		// 재발송 쿨다운 확인
		await this._checkResendCooldown(userId, "PASSWORD_RESET", tx);

		// 기존 미사용 인증 코드 무효화
		await this.verificationRepository.invalidateAllByUserIdAndType(
			userId,
			"PASSWORD_RESET",
			tx,
		);

		// 새 인증 코드 생성
		const result = await this._createVerificationCode(
			userId,
			"PASSWORD_RESET",
			tx,
		);

		// 이메일 발송
		const emailResult = await this.emailService.sendPasswordResetCode(email, {
			code: result.code,
			expiryMinutes: VERIFICATION_CODE.EXPIRY_MINUTES,
		});

		if (!emailResult.success) {
			this.logger.error(
				`Failed to send password reset email to ${email}: ${emailResult.error}`,
			);
		}

		this.logger.log(`Password reset code created for user ${userId}`);
		return result;
	}

	/**
	 * 인증 코드 검증
	 *
	 * 브루트포스 보호:
	 * - 최대 시도 횟수(MAX_ATTEMPTS) 초과 시 검증 거부
	 * - 실패 시 시도 횟수 증가
	 *
	 * @returns 검증 성공 시 true
	 * @throws BusinessException 검증 실패 시
	 */
	async verifyCode(
		userId: string,
		code: string,
		type: VerificationType,
		tx?: Prisma.TransactionClient,
	): Promise<boolean> {
		// 해당 사용자의 유효한 인증 코드 조회 (시도 횟수 포함)
		const verification =
			await this.verificationRepository.findValidByUserIdAndType(
				userId,
				type,
				tx,
			);

		// 유효한 인증 코드가 없음
		if (!verification) {
			throw BusinessExceptions.verificationCodeInvalid();
		}

		// 브루트포스 보호: 최대 시도 횟수 초과 확인
		if (verification.attempts >= VERIFICATION_CODE.MAX_ATTEMPTS) {
			throw BusinessExceptions.verificationMaxAttemptsExceeded();
		}

		const tokenHash = this._hashCode(code);

		// 코드 일치 확인
		if (verification.token !== tokenHash) {
			// 실패 시 시도 횟수 증가 (트랜잭션 외부에서 수행하여 롤백 방지)
			// 브루트포스 보호를 위해 실패 횟수는 항상 영구 저장되어야 함
			await this.verificationRepository.incrementAttempts(verification.id);

			this.logger.warn(
				`Verification attempt failed for user ${userId}, attempts: ${verification.attempts + 1}`,
			);

			throw BusinessExceptions.verificationCodeInvalid();
		}

		// 사용 처리
		await this.verificationRepository.markAsUsed(verification.id, tx);

		this.logger.log(`Verification code verified for user ${userId}`);
		return true;
	}

	/**
	 * 재발송 쿨다운 확인
	 */
	private async _checkResendCooldown(
		userId: string,
		type: VerificationType,
		tx?: Prisma.TransactionClient,
	): Promise<void> {
		const cooldownSince = subtractSeconds(
			VERIFICATION_CODE.RESEND_COOLDOWN_SECONDS,
		);

		const recentCount =
			await this.verificationRepository.countRecentByUserIdAndType(
				userId,
				type,
				cooldownSince,
				tx,
			);

		if (recentCount > 0) {
			throw BusinessExceptions.verificationResendTooSoon(
				VERIFICATION_CODE.RESEND_COOLDOWN_SECONDS,
			);
		}
	}

	/**
	 * 인증 코드 생성 및 저장
	 */
	private async _createVerificationCode(
		userId: string,
		type: VerificationType,
		tx?: Prisma.TransactionClient,
	): Promise<VerificationCodeResult> {
		// 6자리 랜덤 숫자 생성
		const code = this._generateCode();
		const tokenHash = this._hashCode(code);

		// 만료 시간 계산
		const expiresAt = addMinutes(VERIFICATION_CODE.EXPIRY_MINUTES);

		// DB에 저장 (해시된 토큰)
		await this.verificationRepository.create(
			{
				userId,
				type,
				token: tokenHash,
				expiresAt,
			},
			tx,
		);

		return { code, expiresAt };
	}

	/**
	 * 6자리 랜덤 숫자 코드 생성
	 */
	private _generateCode(): string {
		// randomInt는 암호학적으로 안전한 난수 생성
		const min = 10 ** (VERIFICATION_CODE.LENGTH - 1); // 100000
		const max = 10 ** VERIFICATION_CODE.LENGTH; // 1000000
		return randomInt(min, max).toString();
	}

	/**
	 * 코드를 SHA-256 해시로 변환
	 */
	private _hashCode(code: string): string {
		return createHash("sha256").update(code).digest("hex");
	}
}
