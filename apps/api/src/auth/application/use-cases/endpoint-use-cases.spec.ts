import { mock } from "jest-mock-extended";
import {
	CredentialAuthWorkflow,
	OAuthWorkflow,
	PasswordWorkflow,
} from "../workflows";
import {
	GetCurrentUserQuery,
	ListActiveSessionsQuery,
} from "./account/account.use-cases";
import {
	LoginWithPasswordUseCase,
	RegisterUseCase,
} from "./authentication/authentication.use-cases";
import {
	ExchangeOAuthCodeUseCase,
	StartOAuthAuthorizationUseCase,
} from "./oauth/oauth.use-cases";
import {
	RequestPasswordResetUseCase,
	SetPasswordUseCase,
} from "./password/password.use-cases";

describe("auth endpoint use-cases", () => {
	it("인증 endpoint를 독립 실행 단위로 위임한다", async () => {
		const service = mock<CredentialAuthWorkflow>();
		const register = new RegisterUseCase(service);
		const login = new LoginWithPasswordUseCase(service);
		const input: Parameters<CredentialAuthWorkflow["register"]>[0] = {
			email: "user@example.com",
			password: "Password123",
			passwordConfirm: "Password123",
			name: "사용자",
			termsAgreed: true,
			privacyAgreed: true,
			marketingAgreed: false,
			marketingPushAgreed: false,
		};

		await register.execute(input);
		await login.execute({ email: input.email, password: input.password });

		expect(service.register).toHaveBeenCalledWith(input, undefined);
		expect(service.login).toHaveBeenCalledWith(
			{ email: input.email, password: input.password },
			undefined,
		);
	});

	it("계정 query를 command와 분리한다", async () => {
		const service = mock<CredentialAuthWorkflow>();
		const currentUser = new GetCurrentUserQuery(service);
		const sessions = new ListActiveSessionsQuery(service);

		await currentUser.execute("user-1", "user@example.com", "session-1");
		await sessions.execute("user-1");

		expect(service.getCurrentUser).toHaveBeenCalledWith(
			"user-1",
			"user@example.com",
			"session-1",
		);
		expect(service.getActiveSessions).toHaveBeenCalledWith("user-1");
	});

	it("비밀번호 endpoint를 독립 실행 단위로 위임한다", async () => {
		const service = mock<PasswordWorkflow>();
		const requestReset = new RequestPasswordResetUseCase(service);
		const setPassword = new SetPasswordUseCase(service);

		await requestReset.execute("user@example.com");
		await setPassword.execute("user-1", "123456", "NewPassword123");

		expect(service.forgotPassword).toHaveBeenCalledWith(
			"user@example.com",
			undefined,
		);
		expect(service.setPassword).toHaveBeenCalledWith(
			"user-1",
			"123456",
			"NewPassword123",
			undefined,
		);
	});

	it.each([
		["GOOGLE", "generateGoogleAuthUrlWithState"],
		["KAKAO", "generateKakaoAuthUrlWithState"],
		["NAVER", "generateNaverAuthUrlWithState"],
	] as const)(
		"%s OAuth 시작을 대응하는 workflow로 위임한다",
		async (provider, methodName) => {
			const service = mock<OAuthWorkflow>();
			const start = new StartOAuthAuthorizationUseCase(service);

			await start.execute(provider, "state");

			expect(service[methodName]).toHaveBeenCalledWith(
				"state",
				undefined,
				undefined,
				undefined,
			);
		},
	);

	it("OAuth 교환 코드를 독립 실행 단위로 위임한다", async () => {
		const service = mock<OAuthWorkflow>();
		const exchange = new ExchangeOAuthCodeUseCase(service);

		await exchange.execute("exchange-code");

		expect(service.exchangeCodeForTokens).toHaveBeenCalledWith("exchange-code");
	});
});
