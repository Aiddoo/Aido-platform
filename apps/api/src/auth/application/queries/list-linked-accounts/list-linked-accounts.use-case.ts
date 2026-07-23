import { Injectable } from "@nestjs/common";
import { OAuthWorkflow } from "../../workflows/oauth.workflow";

@Injectable()
export class ListLinkedAccountsQuery {
	constructor(private readonly workflow: OAuthWorkflow) {}
	execute(
		userId: Parameters<OAuthWorkflow["getLinkedAccounts"]>[0],
	): ReturnType<OAuthWorkflow["getLinkedAccounts"]> {
		return this.workflow.getLinkedAccounts(userId);
	}
}
