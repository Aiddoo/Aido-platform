import { OAUTH_PROVIDERS } from "@aido/validators";
import { Injectable } from "@nestjs/common";

import type { RequestMetadata } from "../../types";
import { OAuthWorkflow } from "../../workflows/oauth.workflow";

type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];
type WebOAuthProvider = Exclude<OAuthProvider, "APPLE">;

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
				return this.workflow.handleGoogleWebCallbackWithExchangeCode(code, state, metadata);
			case "KAKAO":
				return this.workflow.handleKakaoWebCallbackWithExchangeCode(code, state, metadata);
			case "NAVER":
				return this.workflow.handleNaverWebCallbackWithExchangeCode(code, state, metadata);
		}
	}
}
