import { Injectable } from "@nestjs/common";

import { CredentialAuthWorkflow } from "../../workflows/credential-auth.workflow";

@Injectable()
export class LoginWithPasswordUseCase {
	constructor(private readonly workflow: CredentialAuthWorkflow) {}
	execute(
		input: Parameters<CredentialAuthWorkflow["login"]>[0],
		metadata?: Parameters<CredentialAuthWorkflow["login"]>[1],
	): ReturnType<CredentialAuthWorkflow["login"]> {
		return this.workflow.login(input, metadata);
	}
}
