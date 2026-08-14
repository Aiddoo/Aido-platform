import { Injectable } from "@nestjs/common";

import { PasswordWorkflow } from "../../workflows/password.workflow";

@Injectable()
export class SetPasswordUseCase {
	constructor(private readonly workflow: PasswordWorkflow) {}
	execute(
		userId: Parameters<PasswordWorkflow["setPassword"]>[0],
		code: Parameters<PasswordWorkflow["setPassword"]>[1],
		newPassword: Parameters<PasswordWorkflow["setPassword"]>[2],
		metadata?: Parameters<PasswordWorkflow["setPassword"]>[3],
	): ReturnType<PasswordWorkflow["setPassword"]> {
		return this.workflow.setPassword(userId, code, newPassword, metadata);
	}
}
