import { Injectable } from "@nestjs/common";

import { OAuthWorkflow } from "../../workflows/oauth.workflow.js";

@Injectable()
export class LinkOAuthAccountUseCase {
	constructor(private readonly workflow: OAuthWorkflow) {}
	execute(
		...args: Parameters<OAuthWorkflow["linkSocialAccountWithToken"]>
	): ReturnType<OAuthWorkflow["linkSocialAccountWithToken"]> {
		return this.workflow.linkSocialAccountWithToken(...args);
	}
}
