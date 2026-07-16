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

@Injectable()
export class ResendVerificationUseCase {
	constructor(private readonly workflow: CredentialAuthWorkflow) {}
	execute(
		email: Parameters<CredentialAuthWorkflow["resendVerification"]>[0],
	): ReturnType<CredentialAuthWorkflow["resendVerification"]> {
		return this.workflow.resendVerification(email);
	}
}

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

@Injectable()
export class LogoutUseCase {
	constructor(private readonly workflow: CredentialAuthWorkflow) {}
	execute(
		userId: Parameters<CredentialAuthWorkflow["logout"]>[0],
		sessionId: Parameters<CredentialAuthWorkflow["logout"]>[1],
		metadata?: Parameters<CredentialAuthWorkflow["logout"]>[2],
	): ReturnType<CredentialAuthWorkflow["logout"]> {
		return this.workflow.logout(userId, sessionId, metadata);
	}
}

@Injectable()
export class LogoutAllUseCase {
	constructor(private readonly workflow: CredentialAuthWorkflow) {}
	execute(
		userId: Parameters<CredentialAuthWorkflow["logoutAll"]>[0],
		metadata?: Parameters<CredentialAuthWorkflow["logoutAll"]>[1],
	): ReturnType<CredentialAuthWorkflow["logoutAll"]> {
		return this.workflow.logoutAll(userId, metadata);
	}
}

@Injectable()
export class RefreshTokensUseCase {
	constructor(private readonly workflow: CredentialAuthWorkflow) {}
	execute(
		refreshToken: Parameters<CredentialAuthWorkflow["refreshTokens"]>[0],
		verifiedPayload: Parameters<CredentialAuthWorkflow["refreshTokens"]>[1],
		metadata?: Parameters<CredentialAuthWorkflow["refreshTokens"]>[2],
	): ReturnType<CredentialAuthWorkflow["refreshTokens"]> {
		return this.workflow.refreshTokens(refreshToken, verifiedPayload, metadata);
	}
}
