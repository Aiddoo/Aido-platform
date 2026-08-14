import { OAUTH_PROVIDERS } from "@aido/validators";
import { Injectable } from "@nestjs/common";

import type { RequestMetadata } from "../../types";
import { OAuthWorkflow } from "../../workflows/oauth.workflow";

type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

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
				return this.workflow.handleAppleMobileLogin(token, userName, metadata, nonce);
			case "GOOGLE":
				return this.workflow.handleGoogleMobileLogin(token, userName, metadata);
			case "KAKAO":
				return this.workflow.handleKakaoMobileLogin(token, userName, metadata);
			case "NAVER":
				return this.workflow.handleNaverMobileLogin(token, userName, metadata);
		}
	}
}
