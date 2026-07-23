import { Injectable } from "@nestjs/common";
import { CredentialAuthWorkflow } from "../../workflows/credential-auth.workflow";

@Injectable()
export class ResendVerificationUseCase {
	constructor(private readonly workflow: CredentialAuthWorkflow) {}
	execute(
		email: Parameters<CredentialAuthWorkflow["resendVerification"]>[0],
	): ReturnType<CredentialAuthWorkflow["resendVerification"]> {
		return this.workflow.resendVerification(email);
	}
}
