import { Injectable } from "@nestjs/common";
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

/** 이메일 인증과 비밀번호 흐름의 단일 presentation 진입점. */
@Injectable()
export class AuthFacade {
	constructor(
		private readonly registerUseCase: RegisterUseCase,
		private readonly verifyEmailUseCase: VerifyEmailUseCase,
		private readonly resendVerificationUseCase: ResendVerificationUseCase,
		private readonly loginUseCase: LoginWithPasswordUseCase,
		private readonly logoutUseCase: LogoutUseCase,
		private readonly logoutAllUseCase: LogoutAllUseCase,
		private readonly refreshTokensUseCase: RefreshTokensUseCase,
		private readonly requestPasswordResetUseCase: RequestPasswordResetUseCase,
		private readonly resetPasswordUseCase: ResetPasswordUseCase,
		private readonly requestPasswordSetupCodeUseCase: RequestPasswordSetupCodeUseCase,
		private readonly setPasswordUseCase: SetPasswordUseCase,
		private readonly changePasswordUseCase: ChangePasswordUseCase,
	) {}

	register(
		...args: Parameters<RegisterUseCase["execute"]>
	): ReturnType<RegisterUseCase["execute"]> {
		return this.registerUseCase.execute(...args);
	}

	verifyEmail(
		...args: Parameters<VerifyEmailUseCase["execute"]>
	): ReturnType<VerifyEmailUseCase["execute"]> {
		return this.verifyEmailUseCase.execute(...args);
	}

	resendVerification(
		...args: Parameters<ResendVerificationUseCase["execute"]>
	): ReturnType<ResendVerificationUseCase["execute"]> {
		return this.resendVerificationUseCase.execute(...args);
	}

	login(
		...args: Parameters<LoginWithPasswordUseCase["execute"]>
	): ReturnType<LoginWithPasswordUseCase["execute"]> {
		return this.loginUseCase.execute(...args);
	}

	logout(
		...args: Parameters<LogoutUseCase["execute"]>
	): ReturnType<LogoutUseCase["execute"]> {
		return this.logoutUseCase.execute(...args);
	}

	logoutAll(
		...args: Parameters<LogoutAllUseCase["execute"]>
	): ReturnType<LogoutAllUseCase["execute"]> {
		return this.logoutAllUseCase.execute(...args);
	}

	refreshTokens(
		...args: Parameters<RefreshTokensUseCase["execute"]>
	): ReturnType<RefreshTokensUseCase["execute"]> {
		return this.refreshTokensUseCase.execute(...args);
	}

	forgotPassword(
		...args: Parameters<RequestPasswordResetUseCase["execute"]>
	): ReturnType<RequestPasswordResetUseCase["execute"]> {
		return this.requestPasswordResetUseCase.execute(...args);
	}

	resetPassword(
		...args: Parameters<ResetPasswordUseCase["execute"]>
	): ReturnType<ResetPasswordUseCase["execute"]> {
		return this.resetPasswordUseCase.execute(...args);
	}

	requestPasswordSetupCode(
		...args: Parameters<RequestPasswordSetupCodeUseCase["execute"]>
	): ReturnType<RequestPasswordSetupCodeUseCase["execute"]> {
		return this.requestPasswordSetupCodeUseCase.execute(...args);
	}

	setPassword(
		...args: Parameters<SetPasswordUseCase["execute"]>
	): ReturnType<SetPasswordUseCase["execute"]> {
		return this.setPasswordUseCase.execute(...args);
	}

	changePassword(
		...args: Parameters<ChangePasswordUseCase["execute"]>
	): ReturnType<ChangePasswordUseCase["execute"]> {
		return this.changePasswordUseCase.execute(...args);
	}
}
