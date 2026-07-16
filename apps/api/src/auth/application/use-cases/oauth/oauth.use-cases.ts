import { OAUTH_PROVIDERS } from "@aido/validators";
import { Injectable } from "@nestjs/common";
import type { OAuthMode } from "../../ports/oauth-identity-provider.port";
import type { RequestMetadata } from "../../types";
import { OAuthWorkflow } from "../../workflows/oauth.workflow";

type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];
type WebOAuthProvider = Exclude<OAuthProvider, "APPLE">;

@Injectable()
export class GetOAuthRedirectUriQuery {
	constructor(private readonly workflow: OAuthWorkflow) {}
	execute(state: string): ReturnType<OAuthWorkflow["getRedirectUriByState"]> {
		return this.workflow.getRedirectUriByState(state);
	}
}

@Injectable()
export class StartOAuthAuthorizationUseCase {
	constructor(private readonly workflow: OAuthWorkflow) {}
	execute(
		provider: WebOAuthProvider,
		state: string,
		clientRedirectUri?: string,
		mode?: OAuthMode,
		initiatingUserId?: string,
	): Promise<string> {
		switch (provider) {
			case "GOOGLE":
				return this.workflow.generateGoogleAuthUrlWithState(
					state,
					clientRedirectUri,
					mode,
					initiatingUserId,
				);
			case "KAKAO":
				return this.workflow.generateKakaoAuthUrlWithState(
					state,
					clientRedirectUri,
					mode,
					initiatingUserId,
				);
			case "NAVER":
				return this.workflow.generateNaverAuthUrlWithState(
					state,
					clientRedirectUri,
					mode,
					initiatingUserId,
				);
		}
	}
}

@Injectable()
export class CompleteOAuthAuthorizationUseCase {
	constructor(private readonly workflow: OAuthWorkflow) {}
	execute(
		provider: WebOAuthProvider,
		code: string,
		state: string,
		metadata?: RequestMetadata,
	): ReturnType<OAuthWorkflow["handleGoogleWebCallbackWithExchangeCode"]> {
		switch (provider) {
			case "GOOGLE":
				return this.workflow.handleGoogleWebCallbackWithExchangeCode(
					code,
					state,
					metadata,
				);
			case "KAKAO":
				return this.workflow.handleKakaoWebCallbackWithExchangeCode(
					code,
					state,
					metadata,
				);
			case "NAVER":
				return this.workflow.handleNaverWebCallbackWithExchangeCode(
					code,
					state,
					metadata,
				);
		}
	}
}

@Injectable()
export class LoginWithOAuthTokenUseCase {
	constructor(private readonly workflow: OAuthWorkflow) {}
	execute(
		provider: OAuthProvider,
		token: string,
		userName?: string,
		metadata?: RequestMetadata,
		nonce?: string,
	): ReturnType<OAuthWorkflow["handleAppleMobileLogin"]> {
		switch (provider) {
			case "APPLE":
				return this.workflow.handleAppleMobileLogin(
					token,
					userName,
					metadata,
					nonce,
				);
			case "GOOGLE":
				return this.workflow.handleGoogleMobileLogin(token, userName, metadata);
			case "KAKAO":
				return this.workflow.handleKakaoMobileLogin(token, userName, metadata);
			case "NAVER":
				return this.workflow.handleNaverMobileLogin(token, userName, metadata);
		}
	}
}

@Injectable()
export class LinkOAuthAccountUseCase {
	constructor(private readonly workflow: OAuthWorkflow) {}
	execute(
		...args: Parameters<OAuthWorkflow["linkSocialAccountWithToken"]>
	): ReturnType<OAuthWorkflow["linkSocialAccountWithToken"]> {
		return this.workflow.linkSocialAccountWithToken(...args);
	}
}

@Injectable()
export class LinkOAuthAccountWithCodeUseCase {
	constructor(private readonly workflow: OAuthWorkflow) {}
	execute(
		...args: Parameters<OAuthWorkflow["linkAccountWithExchangeCode"]>
	): ReturnType<OAuthWorkflow["linkAccountWithExchangeCode"]> {
		return this.workflow.linkAccountWithExchangeCode(...args);
	}
}

@Injectable()
export class ExchangeOAuthCodeUseCase {
	constructor(private readonly workflow: OAuthWorkflow) {}
	execute(
		code: Parameters<OAuthWorkflow["exchangeCodeForTokens"]>[0],
	): ReturnType<OAuthWorkflow["exchangeCodeForTokens"]> {
		return this.workflow.exchangeCodeForTokens(code);
	}
}
