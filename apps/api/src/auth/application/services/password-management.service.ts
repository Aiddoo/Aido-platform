import { Injectable, Logger } from "@nestjs/common";
import type { RequestMetadata } from "@/auth/application/types";
import { assertNotDeleted } from "@/auth/application/utils/auth-validation.utils";
import {
	AUTH_DEFAULTS,
	REVOKE_REASON,
	SECURITY_EVENT,
} from "@/auth/domain/constants/auth.constants";
import { PasswordService } from "@/auth/infrastructure/adapters/password.service";
import { AccountRepository } from "@/auth/infrastructure/persistence/account.repository";
import { SecurityLogRepository } from "@/auth/infrastructure/persistence/security-log.repository";
import { SessionRepository } from "@/auth/infrastructure/persistence/session.repository";
import { UserRepository } from "@/auth/infrastructure/persistence/user.repository";
import { BusinessExceptions } from "@/shared/application/exceptions/business-exception.service";
import { maskEmail } from "@/shared/domain/utils/mask.util";
import { DatabaseService } from "@/shared/infrastructure/database";
import { VerificationService } from "./verification.service";

@Injectable()
export class PasswordManagementService {
	readonly #logger = new Logger(PasswordManagementService.name);

	constructor(
		private readonly database: DatabaseService,
		private readonly userRepository: UserRepository,
		private readonly accountRepository: AccountRepository,
		private readonly sessionRepository: SessionRepository,
		private readonly securityLogRepository: SecurityLogRepository,
		private readonly passwordService: PasswordService,
		private readonly verificationService: VerificationService,
	) {}

	async forgotPassword(
		email: string,
		metadata?: RequestMetadata,
	): Promise<{ message: string }> {
		const ip = metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
		const userAgent = metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;

		// 사용자 존재 확인 (존재하지 않아도 보안상 동일한 응답)
		const user = await this.userRepository.findByEmail(email);

		if (user && !user.deletedAt) {
			// 인증 코드 생성 및 이메일 발송
			await this.verificationService.createAndSendPasswordReset(user.id, email);

			// 보안 로그 기록
			await this.securityLogRepository.create({
				userId: user.id,
				event: SECURITY_EVENT.PASSWORD_RESET_REQUESTED,
				ipAddress: ip,
				userAgent,
				metadata: { email },
			});

			this.#logger.debug(`Password reset code sent to: ${maskEmail(email)}`);
		} else {
			this.#logger.debug(`Password reset skipped: ${maskEmail(email)}`);
		}

		// 보안상 동일한 응답 (이메일 존재 여부 노출 방지)
		return {
			message: "등록된 이메일인 경우 비밀번호 재설정 코드가 발송됩니다.",
		};
	}

	async resetPassword(
		email: string,
		code: string,
		newPassword: string,
	): Promise<{ message: string }> {
		// 사용자 조회
		const user = await this.userRepository.findByEmail(email);
		if (!user) {
			throw BusinessExceptions.verificationCodeInvalid();
		}
		assertNotDeleted(user);

		// Credential Account 조회 (소셜 전용 계정이면 비밀번호 재설정 불가)
		const account = await this.accountRepository.findByUserIdAndProvider(
			user.id,
			"CREDENTIAL",
		);
		if (!account) {
			throw BusinessExceptions.noCredentialAccountForPasswordChange(user.id);
		}

		// 새 비밀번호 해싱 (트랜잭션 밖에서 수행 - CPU 작업)
		const hashedPassword = await this.passwordService.hash(newPassword);

		// 트랜잭션으로 인증 검증 + 비밀번호 변경 + 세션 무효화 + 로그 기록
		await this.database.$transaction(async (tx) => {
			// 인증 코드 검증 (PASSWORD_RESET 타입)
			await this.verificationService.verifyCode(
				user.id,
				code,
				"PASSWORD_RESET",
				tx,
			);

			// 비밀번호 업데이트
			await this.accountRepository.updatePassword(user.id, hashedPassword, tx);

			// 모든 세션 무효화 (보안상)
			await this.sessionRepository.revokeAllByUserId(
				user.id,
				REVOKE_REASON.PASSWORD_RESET,
				undefined, // excludeSessionId - 모든 세션 무효화
				tx,
			);

			// 보안 로그 기록
			await this.securityLogRepository.create(
				{
					userId: user.id,
					event: SECURITY_EVENT.PASSWORD_CHANGED,
					ipAddress: AUTH_DEFAULTS.UNKNOWN_IP,
					userAgent: AUTH_DEFAULTS.UNKNOWN_USER_AGENT,
					metadata: { email, reason: REVOKE_REASON.PASSWORD_RESET },
				},
				tx,
			);
		});

		this.#logger.log(`Password reset completed for: ${maskEmail(email)}`);

		return { message: "비밀번호가 재설정되었습니다. 다시 로그인해주세요." };
	}

	async changePassword(
		userId: string,
		currentPassword: string,
		newPassword: string,
		metadata?: RequestMetadata,
		currentSessionId?: string,
	): Promise<{ message: string }> {
		const ip = metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
		const userAgent = metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;

		// 탈퇴 사용자 체크
		const user = await this.userRepository.findById(userId);
		if (!user) throw BusinessExceptions.userNotFound(userId);
		assertNotDeleted(user);

		// Credential Account 조회
		const account = await this.accountRepository.findByUserIdAndProvider(
			userId,
			"CREDENTIAL",
		);
		if (!account?.password) {
			throw BusinessExceptions.noCredentialAccountForPasswordChange(userId);
		}

		// 현재 비밀번호 검증
		const isValid = await this.passwordService.verify(
			account.password,
			currentPassword,
		);
		if (!isValid) {
			throw BusinessExceptions.invalidCredentials();
		}

		// 새 비밀번호 해싱 (트랜잭션 밖에서 수행 - CPU 작업)
		const hashedPassword = await this.passwordService.hash(newPassword);

		// 트랜잭션으로 비밀번호 변경 + 세션 폐기 + 로그 기록
		await this.database.$transaction(async (tx) => {
			// 비밀번호 업데이트
			await this.accountRepository.updatePassword(userId, hashedPassword, tx);

			// 현재 세션 제외 전체 세션 폐기
			await this.sessionRepository.revokeAllByUserId(
				userId,
				REVOKE_REASON.PASSWORD_CHANGED,
				currentSessionId,
				tx,
			);

			// 보안 로그 기록
			await this.securityLogRepository.create(
				{
					userId,
					event: SECURITY_EVENT.PASSWORD_CHANGED,
					ipAddress: ip,
					userAgent,
				},
				tx,
			);
		});

		this.#logger.log(`Password changed for user: ${userId}`);

		return { message: "비밀번호가 변경되었습니다." };
	}

	async requestPasswordSetupCode(userId: string): Promise<{ message: string }> {
		// 1. 유저 조회 + 탈퇴 체크
		const user = await this.userRepository.findById(userId);
		if (!user) throw BusinessExceptions.userNotFound(userId);
		assertNotDeleted(user);

		// 2. CREDENTIAL 계정 존재 여부 확인
		const account = await this.accountRepository.findByUserIdAndProvider(
			userId,
			"CREDENTIAL",
		);
		if (account) {
			throw BusinessExceptions.credentialAccountAlreadyExists(userId);
		}

		// 3. 인증 코드 생성 및 발송
		await this.verificationService.createAndSendPasswordSetup(
			userId,
			user.email,
		);

		return {
			message: "비밀번호 설정 코드가 이메일로 발송되었습니다.",
		};
	}

	async setPassword(
		userId: string,
		code: string,
		newPassword: string,
		metadata?: RequestMetadata,
	): Promise<{ message: string }> {
		const ip = metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
		const userAgent = metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;

		// 1. 유저 조회 + 탈퇴 체크
		const user = await this.userRepository.findById(userId);
		if (!user) throw BusinessExceptions.userNotFound(userId);
		assertNotDeleted(user);

		// 2. CREDENTIAL 계정 존재 여부 확인
		const existingAccount =
			await this.accountRepository.findByUserIdAndProvider(
				userId,
				"CREDENTIAL",
			);
		if (existingAccount) {
			throw BusinessExceptions.credentialAccountAlreadyExists(userId);
		}

		// 3. 비밀번호 해싱 (트랜잭션 밖 - CPU 작업)
		const hashedPassword = await this.passwordService.hash(newPassword);

		// 4. 트랜잭션: 인증 코드 검증 + CREDENTIAL 계정 생성 + 보안 로그
		await this.database.$transaction(async (tx) => {
			// 인증 코드 검증 (PASSWORD_SETUP 타입)
			await this.verificationService.verifyCode(
				userId,
				code,
				"PASSWORD_SETUP",
				tx,
			);

			// CREDENTIAL 계정 생성
			await this.accountRepository.createCredentialAccount(
				userId,
				hashedPassword,
				tx,
			);

			// 보안 로그 기록
			await this.securityLogRepository.create(
				{
					userId,
					event: SECURITY_EVENT.PASSWORD_SETUP,
					ipAddress: ip,
					userAgent,
				},
				tx,
			);
		});

		this.#logger.log(`Password set for social user: ${userId}`);

		// 세션 유지 (changePassword와 달리 기존 세션 폐기하지 않음)
		return {
			message: "비밀번호가 설정되었습니다. 이제 이메일로 로그인할 수 있습니다.",
		};
	}
}
