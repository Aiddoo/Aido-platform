/**
 * PasswordWorkflow 테스트 (Suites 패턴)
 *
 * 비밀번호 관련 workflow 메서드 5개를 테스트합니다.
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
import { asMock } from "@test/mocks";
import {
	REVOKE_REASON,
	SECURITY_EVENT,
} from "@/auth/domain/constants/auth.constants";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import {
	AUTH_PASSWORD_HASHER,
	type AuthPasswordHasherPort,
} from "../ports/auth-crypto.port";
import {
	AUTH_ACCOUNT_REPOSITORY,
	AUTH_SECURITY_LOG_REPOSITORY,
	AUTH_SESSION_REPOSITORY,
	AUTH_USER_REPOSITORY,
	type AuthAccountRepositoryPort,
	type AuthSecurityLogRepositoryPort,
	type AuthSessionRepositoryPort,
	type AuthUserRepositoryPort,
} from "../ports/auth-persistence.port";
import { VerificationService } from "../services/verification.service";
import { PasswordWorkflow } from "./password.workflow";

describe("PasswordWorkflow — 비밀번호 workflow", () => {
	let service: PasswordWorkflow;
	let userRepo: Mocked<AuthUserRepositoryPort>;
	let accountRepo: Mocked<AuthAccountRepositoryPort>;
	let sessionRepo: Mocked<AuthSessionRepositoryPort>;
	let passwordService: Mocked<AuthPasswordHasherPort>;
	let verificationService: Mocked<VerificationService>;
	let uow: Mocked<UnitOfWorkPort>;
	let securityLogRepo: Mocked<AuthSecurityLogRepositoryPort>;

	beforeEach(async () => {
		const { unit, unitRef } =
			await TestBed.solitary(PasswordWorkflow).compile();

		service = unit;
		userRepo = unitRef.get(AUTH_USER_REPOSITORY);
		accountRepo = unitRef.get(AUTH_ACCOUNT_REPOSITORY);
		sessionRepo = unitRef.get(AUTH_SESSION_REPOSITORY);
		passwordService = unitRef.get(AUTH_PASSWORD_HASHER);
		verificationService = unitRef.get(VerificationService);
		uow = unitRef.get(UNIT_OF_WORK);
		securityLogRepo = unitRef.get(AUTH_SECURITY_LOG_REPOSITORY);
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
		const newPassword = "NewPassword123@";

		it("올바른 코드로 비밀번호를 재설정한다", async () => {
			// Given
			const mockUser = UserBuilder.create()
				.withId("user-123")
				.withEmail(email)
				.verified()
				.build();

			userRepo.findByEmail.mockResolvedValue(mockUser);
			asMock(accountRepo.findByUserIdAndProvider).mockResolvedValue({
				id: "account-123",
				userId: mockUser.id,
				password: "old-hashed-password",
			});
			passwordService.hash.mockResolvedValue("new-hashed-password");
			uow.run.mockImplementation((work) => work());
			asMock(verificationService.verifyCode).mockResolvedValue(true);
			asMock(accountRepo.updatePassword).mockResolvedValue({});
			sessionRepo.revokeAllByUserId.mockResolvedValue(2);
			asMock(securityLogRepo.create).mockResolvedValue({});

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
			).rejects.toThrow(ApplicationException);
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
			).rejects.toThrow(ApplicationException);
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
			).rejects.toThrow(ApplicationException);
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
			asMock(accountRepo.findByUserIdAndProvider).mockResolvedValue({
				id: "account-123",
				userId: mockUser.id,
				password: "old-hashed-password",
			});
			passwordService.hash.mockResolvedValue("new-hashed-password");
			uow.run.mockImplementation((work) => work());
			asMock(verificationService.verifyCode).mockResolvedValue(true);
			asMock(accountRepo.updatePassword).mockResolvedValue({});
			sessionRepo.revokeAllByUserId.mockResolvedValue(2);
			asMock(securityLogRepo.create).mockResolvedValue({});

			// When
			await service.resetPassword(email, code, newPassword);

			// Then - excludeSessionId가 undefined (모든 세션 무효화)
			expect(sessionRepo.revokeAllByUserId).toHaveBeenCalledWith(
				mockUser.id,
				REVOKE_REASON.PASSWORD_RESET,
				undefined,
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
			asMock(accountRepo.findByUserIdAndProvider).mockResolvedValue({
				id: "account-123",
				userId: mockUser.id,
				password: "old-hashed-password",
			});
			passwordService.hash.mockResolvedValue("new-hashed-password");
			uow.run.mockImplementation((work) => work());
			asMock(verificationService.verifyCode).mockResolvedValue(true);
			asMock(accountRepo.updatePassword).mockResolvedValue({});
			sessionRepo.revokeAllByUserId.mockResolvedValue(2);
			asMock(securityLogRepo.create).mockResolvedValue({});

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
			);
		});
	});

	describe("changePassword", () => {
		const userId = "user-123";
		const currentPassword = "CurrentPassword123@";
		const newPassword = "NewPassword123@";

		it("현재 비밀번호 확인 후 새 비밀번호로 변경한다", async () => {
			// Given
			const user = UserBuilder.create().withId(userId).verified().build();
			userRepo.findById.mockResolvedValue(user);
			asMock(accountRepo.findByUserIdAndProvider).mockResolvedValue({
				id: "account-123",
				userId,
				password: "current-hashed-password",
			});
			passwordService.verify.mockResolvedValue(true);
			passwordService.hash.mockResolvedValue("new-hashed-password");
			uow.run.mockImplementation((work) => work());
			asMock(accountRepo.updatePassword).mockResolvedValue({});
			asMock(securityLogRepo.create).mockResolvedValue({});

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
			asMock(accountRepo.findByUserIdAndProvider).mockResolvedValue({
				id: "account-123",
				userId,
				password: "current-hashed-password",
			});
			passwordService.verify.mockResolvedValue(false);

			// When & Then
			await expect(
				service.changePassword(userId, currentPassword, newPassword),
			).rejects.toThrow(ApplicationException);
		});

		it("Credential 계정이 없으면 에러를 던진다", async () => {
			// Given
			const user = UserBuilder.create().withId(userId).verified().build();
			userRepo.findById.mockResolvedValue(user);
			accountRepo.findByUserIdAndProvider.mockResolvedValue(null);

			// When & Then
			await expect(
				service.changePassword(userId, currentPassword, newPassword),
			).rejects.toThrow(ApplicationException);
		});

		it("보안 로그를 기록한다", async () => {
			// Given
			const user = UserBuilder.create().withId(userId).verified().build();
			userRepo.findById.mockResolvedValue(user);
			asMock(accountRepo.findByUserIdAndProvider).mockResolvedValue({
				id: "account-123",
				userId,
				password: "current-hashed-password",
			});
			passwordService.verify.mockResolvedValue(true);
			passwordService.hash.mockResolvedValue("new-hashed-password");
			uow.run.mockImplementation((work) => work());
			asMock(accountRepo.updatePassword).mockResolvedValue({});
			asMock(securityLogRepo.create).mockResolvedValue({});

			// When
			await service.changePassword(userId, currentPassword, newPassword);

			// Then
			expect(securityLogRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({
					userId,
					event: SECURITY_EVENT.PASSWORD_CHANGED,
				}),
			);
		});

		describe("세션 폐기", () => {
			const sessionId = "session-current";

			it("비밀번호 변경 후 현재 세션 제외 전체 폐기 확인", async () => {
				// Given
				const user = UserBuilder.create().withId(userId).verified().build();
				userRepo.findById.mockResolvedValue(user);
				asMock(accountRepo.findByUserIdAndProvider).mockResolvedValue({
					id: "account-123",
					userId,
					password: "current-hashed-password",
				});
				passwordService.verify.mockResolvedValue(true);
				passwordService.hash.mockResolvedValue("new-hashed-password");
				uow.run.mockImplementation((work) => work());
				asMock(accountRepo.updatePassword).mockResolvedValue({});
				sessionRepo.revokeAllByUserId.mockResolvedValue(3);
				asMock(securityLogRepo.create).mockResolvedValue({});

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
				).rejects.toThrow(ApplicationException);
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
				).rejects.toThrow(ApplicationException);
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
				ApplicationException,
			);
		});

		it("존재하지 않는 사용자면 에러를 던진다", async () => {
			// Given
			userRepo.findById.mockResolvedValue(null);

			// When & Then
			await expect(service.requestPasswordSetupCode(userId)).rejects.toThrow(
				ApplicationException,
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
				ApplicationException,
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
			uow.run.mockImplementation((work) => work());
			verificationService.verifyCode.mockResolvedValue(true);
			asMock(accountRepo.createCredentialAccount).mockResolvedValue({});
			asMock(securityLogRepo.create).mockResolvedValue({});
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
			).rejects.toThrow(ApplicationException);
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
			).rejects.toThrow(ApplicationException);
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
			).rejects.toThrow(ApplicationException);
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
			);
		});
	});
});
