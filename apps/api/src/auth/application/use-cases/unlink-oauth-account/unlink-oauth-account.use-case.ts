import { Injectable } from "@nestjs/common";

import { OAuthWorkflow } from "../../workflows/oauth.workflow";

@Injectable()
export class UnlinkOAuthAccountUseCase {
	constructor(private readonly workflow: OAuthWorkflow) {}
	execute(
		userId: Parameters<OAuthWorkflow["unlinkAccount"]>[0],
		provider: Parameters<OAuthWorkflow["unlinkAccount"]>[1],
		metadata?: Parameters<OAuthWorkflow["unlinkAccount"]>[2],
	): ReturnType<OAuthWorkflow["unlinkAccount"]> {
		return this.workflow.unlinkAccount(userId, provider, metadata);
	}
}
