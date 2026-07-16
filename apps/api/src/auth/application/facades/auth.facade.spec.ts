import { mock } from "jest-mock-extended";
import {
	ChangePasswordUseCase,
	LoginWithPasswordUseCase,
	LogoutAllUseCase,
	LogoutUseCase,
	RefreshTokensUseCase,
	RegisterUseCase,
	RequestPasswordResetUseCase,
	RequestPasswordSetupCodeUseCase,
	ResendVerificationUseCase,
	ResetPasswordUseCase,
	SetPasswordUseCase,
	VerifyEmailUseCase,
} from "../use-cases";
import { AuthFacade } from "./auth.facade";

describe("AuthFacade — 인증 진입점", () => {
	it("인증·비밀번호 요청을 endpoint use-case에 그대로 위임한다", async () => {
		const register = mock<RegisterUseCase>();
		const verifyEmail = mock<VerifyEmailUseCase>();
		const resendVerification = mock<ResendVerificationUseCase>();
		const login = mock<LoginWithPasswordUseCase>();
		const logout = mock<LogoutUseCase>();
		const logoutAll = mock<LogoutAllUseCase>();
		const refreshTokens = mock<RefreshTokensUseCase>();
		const requestPasswordReset = mock<RequestPasswordResetUseCase>();
		const resetPassword = mock<ResetPasswordUseCase>();
		const requestPasswordSetupCode = mock<RequestPasswordSetupCodeUseCase>();
		const setPassword = mock<SetPasswordUseCase>();
		const changePassword = mock<ChangePasswordUseCase>();
		const facade = new AuthFacade(
			register,
			verifyEmail,
			resendVerification,
			login,
			logout,
			logoutAll,
			refreshTokens,
			requestPasswordReset,
			resetPassword,
			requestPasswordSetupCode,
			setPassword,
			changePassword,
		);
		const metadata = { ip: "127.0.0.1", userAgent: "jest" };
		const refreshPayload = {
			userId: "user-1",
			email: "user@example.com",
			sessionId: "session-1",
			role: "USER" as const,
		};
		const registerInput: Parameters<RegisterUseCase["execute"]>[0] = {
			email: "user@example.com",
			password: "Password123",
			passwordConfirm: "Password123",
			name: "사용자",
			termsAgreed: true,
			privacyAgreed: true,
			marketingAgreed: false,
			marketingPushAgreed: false,
		};

		await facade.register(registerInput, metadata);
		await facade.verifyEmail(
			{ email: "user@example.com", code: "123456" },
			metadata,
		);
		await facade.resendVerification("user@example.com");
		await facade.login(
			{ email: "user@example.com", password: "Password123" },
			metadata,
		);
		await facade.logout("user-1", "session-1", metadata);
		await facade.logoutAll("user-1", metadata);
		await facade.refreshTokens("refresh-token", refreshPayload, metadata);
		await facade.forgotPassword("user@example.com", metadata);
		await facade.resetPassword("user@example.com", "123456", "NewPassword123");
		await facade.requestPasswordSetupCode("user-1");
		await facade.setPassword("user-1", "123456", "NewPassword123", metadata);
		await facade.changePassword(
			"user-1",
			"Password123",
			"NewPassword123",
			metadata,
			"session-1",
		);

		expect(register.execute).toHaveBeenCalledWith(registerInput, metadata);
		expect(verifyEmail.execute).toHaveBeenCalledWith(
			{ email: "user@example.com", code: "123456" },
			metadata,
		);
		expect(resendVerification.execute).toHaveBeenCalledWith("user@example.com");
		expect(login.execute).toHaveBeenCalledWith(
			{ email: "user@example.com", password: "Password123" },
			metadata,
		);
		expect(logout.execute).toHaveBeenCalledWith(
			"user-1",
			"session-1",
			metadata,
		);
		expect(logoutAll.execute).toHaveBeenCalledWith("user-1", metadata);
		expect(refreshTokens.execute).toHaveBeenCalledWith(
			"refresh-token",
			refreshPayload,
			metadata,
		);
		expect(requestPasswordReset.execute).toHaveBeenCalledWith(
			"user@example.com",
			metadata,
		);
		expect(resetPassword.execute).toHaveBeenCalledWith(
			"user@example.com",
			"123456",
			"NewPassword123",
		);
		expect(requestPasswordSetupCode.execute).toHaveBeenCalledWith("user-1");
		expect(setPassword.execute).toHaveBeenCalledWith(
			"user-1",
			"123456",
			"NewPassword123",
			metadata,
		);
		expect(changePassword.execute).toHaveBeenCalledWith(
			"user-1",
			"Password123",
			"NewPassword123",
			metadata,
			"session-1",
		);
	});
});
