import { Injectable } from "@nestjs/common";

import { CredentialAuthWorkflow } from "../../workflows/credential-auth.workflow";

@Injectable()
export class LogoutAllUseCase {
	constructor(private readonly workflow: CredentialAuthWorkflow) {}
	execute(
		userId: Parameters<CredentialAuthWorkflow["logoutAll"]>[0],
		metadata?: Parameters<CredentialAuthWorkflow["logoutAll"]>[1],
	): ReturnType<CredentialAuthWorkflow["logoutAll"]> {
		return this.workflow.logoutAll(userId, metadata);
	}
}
