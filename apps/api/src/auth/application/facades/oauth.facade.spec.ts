import { mock } from "jest-mock-extended";
import { GetOAuthRedirectUriQuery } from "../queries";
import {
	CompleteOAuthAuthorizationUseCase,
	ExchangeOAuthCodeUseCase,
	LinkOAuthAccountUseCase,
	LinkOAuthAccountWithCodeUseCase,
	LoginWithOAuthTokenUseCase,
	StartOAuthAuthorizationUseCase,
} from "../use-cases";
import { OAuthFacade } from "./oauth.facade";

describe("OAuthFacade — OAuth 진입점", () => {
	it("provider 공통 요청을 endpoint use-case에 정확히 위임한다", async () => {
		const redirectUri = mock<GetOAuthRedirectUriQuery>();
		const start = mock<StartOAuthAuthorizationUseCase>();
		const complete = mock<CompleteOAuthAuthorizationUseCase>();
		const login = mock<LoginWithOAuthTokenUseCase>();
		const link = mock<LinkOAuthAccountUseCase>();
		const linkWithCode = mock<LinkOAuthAccountWithCodeUseCase>();
		const exchange = mock<ExchangeOAuthCodeUseCase>();
		const facade = new OAuthFacade(
			redirectUri,
			start,
			complete,
			login,
			link,
			linkWithCode,
			exchange,
		);
		const metadata = { ip: "127.0.0.1", userAgent: "jest" };

		await facade.getRedirectUriByState("state");
		await facade.startAuthorization("GOOGLE", "state", "aido://auth", "login");
		await facade.completeAuthorization("GOOGLE", "code", "state", metadata);
		await facade.loginWithToken("APPLE", "token", "사용자", metadata, "nonce");
		await facade.linkAccountWithToken(
			"user-1",
			{ provider: "GOOGLE", idToken: "token" },
			metadata,
		);
		await facade.linkAccountWithExchangeCode(
			"user-1",
			"exchange-code",
			metadata,
		);
		await facade.exchangeCodeForTokens("exchange-code");

		expect(redirectUri.execute).toHaveBeenCalledWith("state");
		expect(start.execute).toHaveBeenCalledWith(
			"GOOGLE",
			"state",
			"aido://auth",
			"login",
		);
		expect(complete.execute).toHaveBeenCalledWith(
			"GOOGLE",
			"code",
			"state",
			metadata,
		);
		expect(login.execute).toHaveBeenCalledWith(
			"APPLE",
			"token",
			"사용자",
			metadata,
			"nonce",
		);
		expect(link.execute).toHaveBeenCalledWith(
			"user-1",
			{ provider: "GOOGLE", idToken: "token" },
			metadata,
		);
		expect(linkWithCode.execute).toHaveBeenCalledWith(
			"user-1",
			"exchange-code",
			metadata,
		);
		expect(exchange.execute).toHaveBeenCalledWith("exchange-code");
	});
});
