import { Injectable } from "@nestjs/common";
import {
	CompleteOAuthAuthorizationUseCase,
	ExchangeOAuthCodeUseCase,
	GetOAuthRedirectUriQuery,
	LinkOAuthAccountUseCase,
	LinkOAuthAccountWithCodeUseCase,
	LoginWithOAuthTokenUseCase,
	StartOAuthAuthorizationUseCase,
} from "../use-cases";

/** OAuth provider별 차이를 endpoint use-case 뒤로 감추는 presentation 진입점. */
@Injectable()
export class OAuthFacade {
	constructor(
		private readonly getRedirectUriQuery: GetOAuthRedirectUriQuery,
		private readonly startAuthorizationUseCase: StartOAuthAuthorizationUseCase,
		private readonly completeAuthorizationUseCase: CompleteOAuthAuthorizationUseCase,
		private readonly loginWithTokenUseCase: LoginWithOAuthTokenUseCase,
		private readonly linkAccountUseCase: LinkOAuthAccountUseCase,
		private readonly linkAccountWithCodeUseCase: LinkOAuthAccountWithCodeUseCase,
		private readonly exchangeCodeUseCase: ExchangeOAuthCodeUseCase,
	) {}

	getRedirectUriByState(
		...args: Parameters<GetOAuthRedirectUriQuery["execute"]>
	): ReturnType<GetOAuthRedirectUriQuery["execute"]> {
		return this.getRedirectUriQuery.execute(...args);
	}

	startAuthorization(
		...args: Parameters<StartOAuthAuthorizationUseCase["execute"]>
	): ReturnType<StartOAuthAuthorizationUseCase["execute"]> {
		return this.startAuthorizationUseCase.execute(...args);
	}

	completeAuthorization(
		...args: Parameters<CompleteOAuthAuthorizationUseCase["execute"]>
	): ReturnType<CompleteOAuthAuthorizationUseCase["execute"]> {
		return this.completeAuthorizationUseCase.execute(...args);
	}

	loginWithToken(
		...args: Parameters<LoginWithOAuthTokenUseCase["execute"]>
	): ReturnType<LoginWithOAuthTokenUseCase["execute"]> {
		return this.loginWithTokenUseCase.execute(...args);
	}

	linkAccountWithToken(
		...args: Parameters<LinkOAuthAccountUseCase["execute"]>
	): ReturnType<LinkOAuthAccountUseCase["execute"]> {
		return this.linkAccountUseCase.execute(...args);
	}

	linkAccountWithExchangeCode(
		...args: Parameters<LinkOAuthAccountWithCodeUseCase["execute"]>
	): ReturnType<LinkOAuthAccountWithCodeUseCase["execute"]> {
		return this.linkAccountWithCodeUseCase.execute(...args);
	}

	exchangeCodeForTokens(
		...args: Parameters<ExchangeOAuthCodeUseCase["execute"]>
	): ReturnType<ExchangeOAuthCodeUseCase["execute"]> {
		return this.exchangeCodeUseCase.execute(...args);
	}
}
