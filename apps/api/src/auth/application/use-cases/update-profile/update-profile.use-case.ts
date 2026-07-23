import { Injectable } from "@nestjs/common";
import { CredentialAuthWorkflow } from "../../workflows/credential-auth.workflow";

@Injectable()
export class UpdateProfileUseCase {
	constructor(private readonly workflow: CredentialAuthWorkflow) {}
	execute(
		userId: Parameters<CredentialAuthWorkflow["updateProfile"]>[0],
		input: Parameters<CredentialAuthWorkflow["updateProfile"]>[1],
	): ReturnType<CredentialAuthWorkflow["updateProfile"]> {
		return this.workflow.updateProfile(userId, input);
	}
}
