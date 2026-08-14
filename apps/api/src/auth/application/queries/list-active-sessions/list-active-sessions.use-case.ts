import { Injectable } from "@nestjs/common";

import { CredentialAuthWorkflow } from "../../workflows/credential-auth.workflow";

@Injectable()
export class ListActiveSessionsQuery {
	constructor(private readonly workflow: CredentialAuthWorkflow) {}
	execute(
		userId: Parameters<CredentialAuthWorkflow["getActiveSessions"]>[0],
	): ReturnType<CredentialAuthWorkflow["getActiveSessions"]> {
		return this.workflow.getActiveSessions(userId);
	}
}
