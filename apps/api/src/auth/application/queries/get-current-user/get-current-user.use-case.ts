import { Injectable } from "@nestjs/common";
import { CredentialAuthWorkflow } from "../../workflows/credential-auth.workflow";

@Injectable()
export class GetCurrentUserQuery {
	constructor(private readonly workflow: CredentialAuthWorkflow) {}
	execute(
		userId: Parameters<CredentialAuthWorkflow["getCurrentUser"]>[0],
		email: Parameters<CredentialAuthWorkflow["getCurrentUser"]>[1],
		sessionId: Parameters<CredentialAuthWorkflow["getCurrentUser"]>[2],
	): ReturnType<CredentialAuthWorkflow["getCurrentUser"]> {
		return this.workflow.getCurrentUser(userId, email, sessionId);
	}
}
