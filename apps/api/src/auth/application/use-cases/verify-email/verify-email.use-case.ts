import { Injectable } from "@nestjs/common";

import { CredentialAuthWorkflow } from "../../workflows/credential-auth.workflow";

@Injectable()
export class VerifyEmailUseCase {
	constructor(private readonly workflow: CredentialAuthWorkflow) {}
	execute(
		input: Parameters<CredentialAuthWorkflow["verifyEmail"]>[0],
		metadata?: Parameters<CredentialAuthWorkflow["verifyEmail"]>[1],
	): ReturnType<CredentialAuthWorkflow["verifyEmail"]> {
		return this.workflow.verifyEmail(input, metadata);
	}
}
