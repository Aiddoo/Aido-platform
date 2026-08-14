import { Injectable } from "@nestjs/common";

import { OAuthWorkflow } from "../../workflows/oauth.workflow";

@Injectable()
export class LinkOAuthAccountWithCodeUseCase {
	constructor(private readonly workflow: OAuthWorkflow) {}
	execute(
		...args: Parameters<OAuthWorkflow["linkAccountWithExchangeCode"]>
	): ReturnType<OAuthWorkflow["linkAccountWithExchangeCode"]> {
		return this.workflow.linkAccountWithExchangeCode(...args);
	}
}
