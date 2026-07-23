import { Injectable } from "@nestjs/common";
import { CredentialAuthWorkflow } from "../../workflows/credential-auth.workflow";

@Injectable()
export class DeleteAccountUseCase {
	constructor(private readonly workflow: CredentialAuthWorkflow) {}
	execute(
		userId: Parameters<CredentialAuthWorkflow["deleteAccount"]>[0],
		sessionId: Parameters<CredentialAuthWorkflow["deleteAccount"]>[1],
		input: Parameters<CredentialAuthWorkflow["deleteAccount"]>[2],
		metadata?: Parameters<CredentialAuthWorkflow["deleteAccount"]>[3],
	): ReturnType<CredentialAuthWorkflow["deleteAccount"]> {
		return this.workflow.deleteAccount(userId, sessionId, input, metadata);
	}
}
