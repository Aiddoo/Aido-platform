import { Injectable } from "@nestjs/common";
import { OAuthWorkflow } from "../../workflows/oauth.workflow";

@Injectable()
export class GetOAuthRedirectUriQuery {
	constructor(private readonly workflow: OAuthWorkflow) {}
	execute(state: string): ReturnType<OAuthWorkflow["getRedirectUriByState"]> {
		return this.workflow.getRedirectUriByState(state);
	}
}
