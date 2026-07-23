import { OAUTH_PROVIDERS } from "@aido/validators";
import { Injectable } from "@nestjs/common";
import type { OAuthMode } from "../../ports/oauth-identity-provider.port";
import { OAuthWorkflow } from "../../workflows/oauth.workflow";

type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];
type WebOAuthProvider = Exclude<OAuthProvider, "APPLE">;
type StartAuthorizationMethod =
	| "generateGoogleAuthUrlWithState"
	| "generateKakaoAuthUrlWithState"
	| "generateNaverAuthUrlWithState";

const START_AUTHORIZATION_METHOD_BY_PROVIDER = {
	GOOGLE: "generateGoogleAuthUrlWithState",
	KAKAO: "generateKakaoAuthUrlWithState",
	NAVER: "generateNaverAuthUrlWithState",
} as const satisfies Record<WebOAuthProvider, StartAuthorizationMethod>;

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
		const methodName = START_AUTHORIZATION_METHOD_BY_PROVIDER[provider];
		return this.workflow[methodName](
			state,
			clientRedirectUri,
			mode,
			initiatingUserId,
		);
	}
}
