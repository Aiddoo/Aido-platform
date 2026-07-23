import { Injectable } from "@nestjs/common";
import { PasswordWorkflow } from "../../workflows/password.workflow";

@Injectable()
export class ResetPasswordUseCase {
	constructor(private readonly workflow: PasswordWorkflow) {}
	execute(
		email: Parameters<PasswordWorkflow["resetPassword"]>[0],
		code: Parameters<PasswordWorkflow["resetPassword"]>[1],
		newPassword: Parameters<PasswordWorkflow["resetPassword"]>[2],
	): ReturnType<PasswordWorkflow["resetPassword"]> {
		return this.workflow.resetPassword(email, code, newPassword);
	}
}
