import { Injectable } from "@nestjs/common";

import { CredentialAuthWorkflow } from "../../workflows/credential-auth.workflow";

@Injectable()
export class RevokeSessionUseCase {
	constructor(private readonly workflow: CredentialAuthWorkflow) {}
	execute(
		userId: Parameters<CredentialAuthWorkflow["revokeSession"]>[0],
		sessionId: Parameters<CredentialAuthWorkflow["revokeSession"]>[1],
		metadata?: Parameters<CredentialAuthWorkflow["revokeSession"]>[2],
	): ReturnType<CredentialAuthWorkflow["revokeSession"]> {
		return this.workflow.revokeSession(userId, sessionId, metadata);
	}
}
