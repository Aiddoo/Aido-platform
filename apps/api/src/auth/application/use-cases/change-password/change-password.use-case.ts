import { Injectable } from "@nestjs/common";

import { PasswordWorkflow } from "../../workflows/password.workflow";

@Injectable()
export class ChangePasswordUseCase {
	constructor(private readonly workflow: PasswordWorkflow) {}
	execute(
		userId: Parameters<PasswordWorkflow["changePassword"]>[0],
		currentPassword: Parameters<PasswordWorkflow["changePassword"]>[1],
		newPassword: Parameters<PasswordWorkflow["changePassword"]>[2],
		metadata?: Parameters<PasswordWorkflow["changePassword"]>[3],
		currentSessionId?: Parameters<PasswordWorkflow["changePassword"]>[4],
	): ReturnType<PasswordWorkflow["changePassword"]> {
		return this.workflow.changePassword(
			userId,
			currentPassword,
			newPassword,
			metadata,
			currentSessionId,
		);
	}
}
