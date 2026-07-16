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

@Injectable()
export class RequestPasswordSetupCodeUseCase {
	constructor(private readonly workflow: PasswordWorkflow) {}
	execute(
		userId: Parameters<PasswordWorkflow["requestPasswordSetupCode"]>[0],
	): ReturnType<PasswordWorkflow["requestPasswordSetupCode"]> {
		return this.workflow.requestPasswordSetupCode(userId);
	}
}

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
