import { Injectable } from "@nestjs/common";

import { CredentialAuthWorkflow } from "../../workflows/credential-auth.workflow";

@Injectable()
export class RegisterUseCase {
	constructor(private readonly workflow: CredentialAuthWorkflow) {}
	execute(
		input: Parameters<CredentialAuthWorkflow["register"]>[0],
		metadata?: Parameters<CredentialAuthWorkflow["register"]>[1],
	): ReturnType<CredentialAuthWorkflow["register"]> {
		return this.workflow.register(input, metadata);
	}
}
