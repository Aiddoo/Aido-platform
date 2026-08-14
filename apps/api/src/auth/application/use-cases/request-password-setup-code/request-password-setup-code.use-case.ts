import { Injectable } from "@nestjs/common";

import { PasswordWorkflow } from "../../workflows/password.workflow";

@Injectable()
export class RequestPasswordSetupCodeUseCase {
	constructor(private readonly workflow: PasswordWorkflow) {}
	execute(
		userId: Parameters<PasswordWorkflow["requestPasswordSetupCode"]>[0],
	): ReturnType<PasswordWorkflow["requestPasswordSetupCode"]> {
		return this.workflow.requestPasswordSetupCode(userId);
	}
}
