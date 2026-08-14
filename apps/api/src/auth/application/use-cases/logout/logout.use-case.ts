import { Injectable } from "@nestjs/common";

import { CredentialAuthWorkflow } from "../../workflows/credential-auth.workflow";

@Injectable()
export class LogoutUseCase {
	constructor(private readonly workflow: CredentialAuthWorkflow) {}
	execute(
		userId: Parameters<CredentialAuthWorkflow["logout"]>[0],
		sessionId: Parameters<CredentialAuthWorkflow["logout"]>[1],
		metadata?: Parameters<CredentialAuthWorkflow["logout"]>[2],
	): ReturnType<CredentialAuthWorkflow["logout"]> {
		return this.workflow.logout(userId, sessionId, metadata);
	}
}
