import { Injectable } from "@nestjs/common";

import { PasswordWorkflow } from "../../workflows/password.workflow";

@Injectable()
export class RequestPasswordResetUseCase {
	constructor(private readonly workflow: PasswordWorkflow) {}
	execute(
		email: Parameters<PasswordWorkflow["forgotPassword"]>[0],
		metadata?: Parameters<PasswordWorkflow["forgotPassword"]>[1],
	): ReturnType<PasswordWorkflow["forgotPassword"]> {
		return this.workflow.forgotPassword(email, metadata);
	}
}
