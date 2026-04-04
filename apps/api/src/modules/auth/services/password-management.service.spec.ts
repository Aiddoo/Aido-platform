/**
 * PasswordManagementService 테스트 (Suites 패턴)
 *
 * AuthService에서 분리된 비밀번호 관련 메서드 5개를 테스트합니다.
 * - forgotPassword
 * - resetPassword
 * - changePassword
 * - requestPasswordSetupCode
 * - setPassword
 *
 * @see https://docs.nestjs.com/recipes/suites
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { AccountBuilder, UserBuilder } from "@test/builders";
import { type TransactionCallback } from "@test/mocks";
import type { TransactionClient } from "@/common/database/prisma.types";
import { BusinessException } from "@/common/exception/services/business-exception.service";
import { DatabaseService } from "@/database";
import { type Account, type SecurityLog } from "@/generated/prisma/client";
import { REVOKE_REASON, SECURITY_EVENT } from "../constants/auth.constants";
import { AccountRepository } from "../repositories/account.repository";
import { SecurityLogRepository } from "../repositories/security-log.repository";
import { SessionRepository } from "../repositories/session.repository";
import { UserRepository } from "../repositories/user.repository";
import { PasswordService } from "./password.service";
import { PasswordManagementService } from "./password-management.service";
import { VerificationService } from "./verification.service";

describe("PasswordManagementService — 비밀번호 서비스", () => {
	let service: PasswordManagementService;
	let userRepo: Mocked<UserRepository>;
	let accountRepo: Mocked<AccountRepository>;
	let sessionRepo: Mocked<SessionRepository>;
	let passwordService: Mocked<PasswordService>;
	let verificationService: Mocked<VerificationService>;
	let database: Mocked<DatabaseService>;
	let securityLogRepo: Mocked<SecurityLogRepository>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			PasswordManagementService,
		).compile();

		service = unit;
		userRepo = unitRef.get(UserRepository);
		accountRepo = unitRef.get(AccountRepository);
		sessionRepo = unitRef.get(SessionRepository);
		passwordService = unitRef.get(PasswordService);
		verificationService = unitRef.get(VerificationService);
		database = unitRef.get(DatabaseService);
		securityLogRepo = unitRef.get(SecurityLogRepository);
	});

	describe("forgotPassword", () => {
		const email = "test@example.com";

		it("비밀번호 재설정 코드를 발송한다", async () => {
			// Given
			const mockUser = UserBuilder.create()
				.withId("user-123")
				.withEmail(email)
				.verified()
				.build();

			userRepo.findByEmail.mockResolvedValue(mockUser);
			verificationService.createAndSendPasswordReset.mockResolvedValue({
				code: "123456",
				expiresAt: new Date(),
			});

			// When
			const result = await service.forgotPassword(email);

			// Then
			expect(
				verificationService.createAndSendPasswordReset,
			).toHaveBeenCalledWith(mockUser.id, email);
			expect(securityLogRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: mockUser.id,
					event: SECURITY_EVENT.PASSWORD_RESET_REQUESTED,
					metadata: { email },
				}),
			);
			expect(result.message).toBeDefined();
		});

		it("존재하지 않는 이메일도 동일한 응답을 반환한다 (보안)", async () => {
			// Given
			userRepo.findByEmail.mockResolvedValue(null);

			// When
			const result = await service.forgotPassword(email);

			// Then
			expect(result.message).toBeDefined();
			expect(
				verificationService.createAndSendPasswordReset,
			).not.toHaveBeenCalled();
		});

		it("탈퇴한 사용자에게 비밀번호 재설정 코드를 발송하지 않는다", async () => {
			// Given
			const deletedUser = UserBuilder.create()
				.withEmail(email)
				.deleted()
				.build();
			userRepo.findByEmail.mockResolvedValue(deletedUser);

			// When
			const result = await service.forgotPassword(email);

			// Then — 보안상 동일 응답, 이메일 미발송
			expect(result.message).toBeDefined();
			expect(
				verificationService.createAndSendPasswordReset,
			).not.toHaveBeenCalled();
		});
	});

	describe("resetPassword", () => {
		const email = "test@example.com";
		const code = "123456";
		const newPassword = "NewPassword123!";

		it("올바른 코드로 비밀번호를 재설정한다", async () => {
			// Given
			const mockUser = UserBuilder.create()
				.withId("user-123")
				.withEmail(email)
				.verified()
				.build();

			userRepo.findByEmail.mockResolvedValue(mockUser);
			accountRepo.findByUserIdAndProvider.mockResolvedValue({
				id: "account-123",
				userId: mockUser.id,
				password: "old-hashed-password",
			} as unknown as Account);
			passwordService.hash.mockResolvedValue("new-hashed-password");
			database.$transaction.mockImplementation(
				async (callback: TransactionCallback) =>
					callback({} as TransactionClient),
			);
			verificationService.verifyCode.mockResolvedValue(true as boolean);
			accountRepo.updatePassword.mockResolvedValue({} as unknown as Account);
			sessionRepo.revokeAllByUserId.mockResolvedValue(2);
			securityLogRepo.create.mockResolvedValue({} as SecurityLog);

			// When
			const result = await service.resetPassword(email, code, newPassword);

			// Then
			expect(result.message).toContain("비밀번호가 재설정되었습니다");
		});

		it("존재하지 않는 사용자면 에러를 던진다", async () => {
			// Given
			userRepo.findByEmail.mockResolvedValue(null);

			// When & Then
			await expect(
				service.resetPassword(email, code, newPassword),
			).rejects.toThrow(BusinessException);
		});

		it("소셜 전용 계정(Credential 없음)이면 USER_0613 에러를 던진다", async () => {
			// Given
			const mockUser = UserBuilder.create()
				.withId("user-123")
				.withEmail(email)
				.build();

			userRepo.findByEmail.mockResolvedValue(mockUser);
			accountRepo.findByUserIdAndProvider.mockResolvedValue(null);

			// When & Then
			await expect(
				service.resetPassword(email, code, newPassword),
			).rejects.toThrow(BusinessException);
		});

		it("탈퇴한 사용자의 비밀번호 재설정 시 USER_0606 에러", async () => {
			// Given
			const deletedUser = UserBuilder.create()
				.withEmail(email)
				.deleted()
				.build();
			userRepo.findByEmail.mockResolvedValue(deletedUser);

			// When & Then
			await expect(
				service.resetPassword(email, code, newPassword),
			).rejects.toThrow(BusinessException);
			expect(accountRepo.updatePassword).not.toHaveBeenCalled();
		});

		it("재설정 후 모든 세션을 무효화한다 (excludeSessionId=undefined)", async () => {
			// Given
			const mockUser = UserBuilder.create()
				.withId("user-123")
				.withEmail(email)
				.verified()
				.build();

			userRepo.findByEmail.mockResolvedValue(mockUser);
			accountRepo.findByUserIdAndProvider.mockResolvedValue({
				id: "account-123",
				userId: mockUser.id,
				password: "old-hashed-password",
			} as unknown as Account);
			passwordService.hash.mockResolvedValue("new-hashed-password");
			database.$transaction.mockImplementation(
				async (callback: TransactionCallback) =>
					callback({} as TransactionClient),
			);
			verificationService.verifyCode.mockResolvedValue(true as boolean);
			accountRepo.updatePassword.mockResolvedValue({} as unknown as Account);
			sessionRepo.revokeAllByUserId.mockResolvedValue(2);
			securityLogRepo.create.mockResolvedValue({} as SecurityLog);

			// When
			await service.resetPassword(email, code, newPassword);

			// Then - excludeSessionId가 undefined (모든 세션 무효화)
			expect(sessionRepo.revokeAllByUserId).toHaveBeenCalledWith(
				mockUser.id,
				REVOKE_REASON.PASSWORD_RESET,
				undefined,
				expect.any(Object),
			);
		});

		it("보안 로그에 PASSWORD_CHANGED 이벤트와 PASSWORD_RESET 사유를 기록한다", async () => {
			// Given
			const mockUser = UserBuilder.create()
				.withId("user-123")
				.withEmail(email)
				.verified()
				.build();

			userRepo.findByEmail.mockResolvedValue(mockUser);
			accountRepo.findByUserIdAndProvider.mockResolvedValue({
				id: "account-123",
				userId: mockUser.id,
				password: "old-hashed-password",
			} as unknown as Account);
			passwordService.hash.mockResolvedValue("new-hashed-password");
			database.$transaction.mockImplementation(
				async (callback: TransactionCallback) =>
					callback({} as TransactionClient),
			);
			verificationService.verifyCode.mockResolvedValue(true as boolean);
			accountRepo.updatePassword.mockResolvedValue({} as unknown as Account);
			sessionRepo.revokeAllByUserId.mockResolvedValue(2);
			securityLogRepo.create.mockResolvedValue({} as SecurityLog);

			// When
			await service.resetPassword(email, code, newPassword);

			// Then
			expect(securityLogRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: mockUser.id,
					event: SECURITY_EVENT.PASSWORD_CHANGED,
					metadata: expect.objectContaining({
						reason: REVOKE_REASON.PASSWORD_RESET,
					}),
				}),
				expect.any(Object),
			);
		});
	});

	describe("changePassword", () => {
		const userId = "user-123";
		const currentPassword = "CurrentPassword123!";
		const newPassword = "NewPassword123!";

		it("현재 비밀번호 확인 후 새 비밀번호로 변경한다", async () => {
			// Given
			const user = UserBuilder.create().withId(userId).verified().build();
			userRepo.findById.mockResolvedValue(user);
			accountRepo.findByUserIdAndProvider.mockResolvedValue({
				id: "account-123",
				userId,
				password: "current-hashed-password",
			} as unknown as Account);
			passwordService.verify.mockResolvedValue(true);
			passwordService.hash.mockResolvedValue("new-hashed-password");
			database.$transaction.mockImplementation(
				async (callback: TransactionCallback) =>
					callback({} as TransactionClient),
			);
			accountRepo.updatePassword.mockResolvedValue({} as unknown as Account);
			securityLogRepo.create.mockResolvedValue({} as SecurityLog);

			// When
			const result = await service.changePassword(
				userId,
				currentPassword,
				newPassword,
			);

			// Then
			expect(passwordService.verify).toHaveBeenCalled();
			expect(result.message).toContain("비밀번호가 변경되었습니다");
		});

		it("현재 비밀번호가 틀리면 에러를 던진다", async () => {
			// Given
			const user = UserBuilder.create().withId(userId).verified().build();
			userRepo.findById.mockResolvedValue(user);
			accountRepo.findByUserIdAndProvider.mockResolvedValue({
				id: "account-123",
				userId,
				password: "current-hashed-password",
			} as unknown as Account);
			passwordService.verify.mockResolvedValue(false);

			// When & Then
			await expect(
				service.changePassword(userId, currentPassword, newPassword),
			).rejects.toThrow(BusinessException);
		});

		it("Credential 계정이 없으면 에러를 던진다", async () => {
			// Given
			const user = UserBuilder.create().withId(userId).verified().build();
			userRepo.findById.mockResolvedValue(user);
			accountRepo.findByUserIdAndProvider.mockResolvedValue(null);

			// When & Then
			await expect(
				service.changePassword(userId, currentPassword, newPassword),
			).rejects.toThrow(BusinessException);
		});

		it("보안 로그를 기록한다", async () => {
			// Given
			const user = UserBuilder.create().withId(userId).verified().build();
			userRepo.findById.mockResolvedValue(user);
			accountRepo.findByUserIdAndProvider.mockResolvedValue({
				id: "account-123",
				userId,
				password: "current-hashed-password",
			} as unknown as Account);
			passwordService.verify.mockResolvedValue(true);
			passwordService.hash.mockResolvedValue("new-hashed-password");
			database.$transaction.mockImplementation(
				async (callback: TransactionCallback) =>
					callback({} as TransactionClient),
			);
			accountRepo.updatePassword.mockResolvedValue({} as unknown as Account);
			securityLogRepo.create.mockResolvedValue({} as SecurityLog);

			// When
			await service.changePassword(userId, currentPassword, newPassword);

			// Then
			expect(securityLogRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({
					userId,
					event: SECURITY_EVENT.PASSWORD_CHANGED,
				}),
				expect.any(Object),
			);
		});

		describe("세션 폐기", () => {
			const sessionId = "session-current";

			it("비밀번호 변경 후 현재 세션 제외 전체 폐기 확인", async () => {
				// Given
				const user = UserBuilder.create().withId(userId).verified().build();
				userRepo.findById.mockResolvedValue(user);
				accountRepo.findByUserIdAndProvider.mockResolvedValue({
					id: "account-123",
					userId,
					password: "current-hashed-password",
				} as unknown as Account);
				passwordService.verify.mockResolvedValue(true);
				passwordService.hash.mockResolvedValue("new-hashed-password");
				database.$transaction.mockImplementation(
					async (callback: TransactionCallback) =>
						callback({} as TransactionClient),
				);
				accountRepo.updatePassword.mockResolvedValue({} as unknown as Account);
				sessionRepo.revokeAllByUserId.mockResolvedValue(3);
				securityLogRepo.create.mockResolvedValue({} as SecurityLog);

				// When
				await service.changePassword(
					userId,
					currentPassword,
					newPassword,
					undefined,
					sessionId,
				);

				// Then
				expect(sessionRepo.revokeAllByUserId).toHaveBeenCalledWith(
					userId,
					REVOKE_REASON.PASSWORD_CHANGED,
					sessionId,
					expect.any(Object),
				);
			});

			it("소셜 전용 사용자 시 USER_0613 에러", async () => {
				// Given
				const user = UserBuilder.create().withId(userId).verified().build();
				userRepo.findById.mockResolvedValue(user);
				accountRepo.findByUserIdAndProvider.mockResolvedValue(null);

				// When & Then
				await expect(
					service.changePassword(userId, currentPassword, newPassword),
				).rejects.toThrow(BusinessException);
			});

			it("탈퇴한 사용자의 비밀번호 변경 시 USER_0606 에러", async () => {
				// Given
				const deletedUser = UserBuilder.create()
					.withId(userId)
					.deleted()
					.build();
				userRepo.findById.mockResolvedValue(deletedUser);

				// When & Then
				await expect(
					service.changePassword(userId, currentPassword, newPassword),
				).rejects.toThrow(BusinessException);
				expect(accountRepo.findByUserIdAndProvider).not.toHaveBeenCalled();
			});
		});
	});

	describe("requestPasswordSetupCode", () => {
		const userId = "user-setup-1";

		it("소셜 전용 사용자에게 인증 코드를 발송한다", async () => {
			// Given
			const user = UserBuilder.create().withId(userId).verified().build();
			userRepo.findById.mockResolvedValue(user);
			accountRepo.findByUserIdAndProvider.mockResolvedValue(null);
			verificationService.createAndSendPasswordSetup.mockResolvedValue({
				code: "123456",
				expiresAt: new Date(),
			});

			// When
			const result = await service.requestPasswordSetupCode(userId);

			// Then
			expect(result.message).toBeDefined();
			expect(accountRepo.findByUserIdAndProvider).toHaveBeenCalledWith(
				userId,
				"CREDENTIAL",
			);
			expect(
				verificationService.createAndSendPasswordSetup,
			).toHaveBeenCalledWith(userId, user.email);
		});

		it("CREDENTIAL 계정이 이미 존재하면 에러를 던진다", async () => {
			// Given
			const user = UserBuilder.create().withId(userId).verified().build();
			userRepo.findById.mockResolvedValue(user);
			const account = AccountBuilder.create(userId).asCredential().build();
			accountRepo.findByUserIdAndProvider.mockResolvedValue(account);

			// When & Then
			await expect(service.requestPasswordSetupCode(userId)).rejects.toThrow(
				BusinessException,
			);
		});

		it("존재하지 않는 사용자면 에러를 던진다", async () => {
			// Given
			userRepo.findById.mockResolvedValue(null);

			// When & Then
			await expect(service.requestPasswordSetupCode(userId)).rejects.toThrow(
				BusinessException,
			);
		});

		it("탈퇴한 사용자면 에러를 던진다", async () => {
			// Given
			const user = UserBuilder.create()
				.withId(userId)
				.verified()
				.deleted()
				.build();
			userRepo.findById.mockResolvedValue(user);

			// When & Then
			await expect(service.requestPasswordSetupCode(userId)).rejects.toThrow(
				BusinessException,
			);
		});
	});

	describe("setPassword", () => {
		const userId = "user-setup-2";
		const code = "123456";
		const newPassword = "NewPassword1";
		const metadata = { ip: "127.0.0.1", userAgent: "test-agent" };

		/**
		 * setPassword 성공 시나리오 mock 설정 헬퍼
		 */
		const setupSuccessfulSetPassword = () => {
			const user = UserBuilder.create().withId(userId).verified().build();
			userRepo.findById.mockResolvedValue(user);
			accountRepo.findByUserIdAndProvider.mockResolvedValue(null);
			passwordService.hash.mockResolvedValue("hashed-password");
			database.$transaction.mockImplementation(
				async (callback: TransactionCallback) =>
					callback({} as TransactionClient),
			);
			verificationService.verifyCode.mockResolvedValue(true);
			accountRepo.createCredentialAccount.mockResolvedValue(
				{} as unknown as Account,
			);
			securityLogRepo.create.mockResolvedValue({} as SecurityLog);
			return user;
		};

		it("인증 코드 검증 후 비밀번호를 설정한다", async () => {
			// Given
			setupSuccessfulSetPassword();

			// When
			const result = await service.setPassword(
				userId,
				code,
				newPassword,
				metadata,
			);

			// Then
			expect(result.message).toBeDefined();
			expect(passwordService.hash).toHaveBeenCalledWith(newPassword);
		});

		it("CREDENTIAL 계정을 생성한다", async () => {
			// Given
			setupSuccessfulSetPassword();

			// When
			await service.setPassword(userId, code, newPassword, metadata);

			// Then
			expect(accountRepo.createCredentialAccount).toHaveBeenCalledWith(
				userId,
				"hashed-password",
				expect.any(Object),
			);
		});

		it("보안 로그를 기록한다 (PASSWORD_SETUP)", async () => {
			// Given
			setupSuccessfulSetPassword();

			// When
			await service.setPassword(userId, code, newPassword, metadata);

			// Then
			expect(securityLogRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({
					userId,
					event: SECURITY_EVENT.PASSWORD_SETUP,
				}),
				expect.any(Object),
			);
		});

		it("세션을 유지한다 (revokeAllByUserId 호출하지 않음)", async () => {
			// Given
			setupSuccessfulSetPassword();

			// When
			await service.setPassword(userId, code, newPassword, metadata);

			// Then
			expect(sessionRepo.revokeAllByUserId).not.toHaveBeenCalled();
		});

		it("CREDENTIAL 계정이 이미 존재하면 에러를 던진다", async () => {
			// Given
			const user = UserBuilder.create().withId(userId).verified().build();
			userRepo.findById.mockResolvedValue(user);
			const account = AccountBuilder.create(userId).asCredential().build();
			accountRepo.findByUserIdAndProvider.mockResolvedValue(account);

			// When & Then
			await expect(
				service.setPassword(userId, code, newPassword, metadata),
			).rejects.toThrow(BusinessException);
		});

		it("비밀번호를 Argon2id로 해싱한다", async () => {
			// Given
			setupSuccessfulSetPassword();

			// When
			await service.setPassword(userId, code, newPassword, metadata);

			// Then
			expect(passwordService.hash).toHaveBeenCalledWith(newPassword);
		});

		it("존재하지 않는 사용자면 에러를 던진다", async () => {
			// Given
			userRepo.findById.mockResolvedValue(null);

			// When & Then
			await expect(
				service.setPassword(userId, code, newPassword, metadata),
			).rejects.toThrow(BusinessException);
		});

		it("탈퇴한 사용자면 에러를 던진다", async () => {
			// Given
			const user = UserBuilder.create()
				.withId(userId)
				.verified()
				.deleted()
				.build();
			userRepo.findById.mockResolvedValue(user);

			// When & Then
			await expect(
				service.setPassword(userId, code, newPassword, metadata),
			).rejects.toThrow(BusinessException);
		});

		it("인증 코드를 PASSWORD_SETUP 타입으로 검증한다", async () => {
			// Given
			setupSuccessfulSetPassword();

			// When
			await service.setPassword(userId, code, newPassword, metadata);

			// Then
			expect(verificationService.verifyCode).toHaveBeenCalledWith(
				userId,
				code,
				"PASSWORD_SETUP",
				expect.any(Object),
			);
		});
	});
});
