import { Injectable } from "@nestjs/common";
import { CredentialAuthWorkflow } from "../../workflows/credential-auth.workflow";
import { OAuthWorkflow } from "../../workflows/oauth.workflow";

@Injectable()
export class GetCurrentUserQuery {
	constructor(private readonly workflow: CredentialAuthWorkflow) {}
	execute(
		userId: Parameters<CredentialAuthWorkflow["getCurrentUser"]>[0],
		email: Parameters<CredentialAuthWorkflow["getCurrentUser"]>[1],
		sessionId: Parameters<CredentialAuthWorkflow["getCurrentUser"]>[2],
	): ReturnType<CredentialAuthWorkflow["getCurrentUser"]> {
		return this.workflow.getCurrentUser(userId, email, sessionId);
	}
}

@Injectable()
export class UpdateProfileUseCase {
	constructor(private readonly workflow: CredentialAuthWorkflow) {}
	execute(
		userId: Parameters<CredentialAuthWorkflow["updateProfile"]>[0],
		input: Parameters<CredentialAuthWorkflow["updateProfile"]>[1],
	): ReturnType<CredentialAuthWorkflow["updateProfile"]> {
		return this.workflow.updateProfile(userId, input);
	}
}

@Injectable()
export class DeleteAccountUseCase {
	constructor(private readonly workflow: CredentialAuthWorkflow) {}
	execute(
		userId: Parameters<CredentialAuthWorkflow["deleteAccount"]>[0],
		sessionId: Parameters<CredentialAuthWorkflow["deleteAccount"]>[1],
		input: Parameters<CredentialAuthWorkflow["deleteAccount"]>[2],
		metadata?: Parameters<CredentialAuthWorkflow["deleteAccount"]>[3],
	): ReturnType<CredentialAuthWorkflow["deleteAccount"]> {
		return this.workflow.deleteAccount(userId, sessionId, input, metadata);
	}
}

@Injectable()
export class ListLinkedAccountsQuery {
	constructor(private readonly workflow: OAuthWorkflow) {}
	execute(
		userId: Parameters<OAuthWorkflow["getLinkedAccounts"]>[0],
	): ReturnType<OAuthWorkflow["getLinkedAccounts"]> {
		return this.workflow.getLinkedAccounts(userId);
	}
}

@Injectable()
export class UnlinkOAuthAccountUseCase {
	constructor(private readonly workflow: OAuthWorkflow) {}
	execute(
		userId: Parameters<OAuthWorkflow["unlinkAccount"]>[0],
		provider: Parameters<OAuthWorkflow["unlinkAccount"]>[1],
		metadata?: Parameters<OAuthWorkflow["unlinkAccount"]>[2],
	): ReturnType<OAuthWorkflow["unlinkAccount"]> {
		return this.workflow.unlinkAccount(userId, provider, metadata);
	}
}

@Injectable()
export class ListActiveSessionsQuery {
	constructor(private readonly workflow: CredentialAuthWorkflow) {}
	execute(
		userId: Parameters<CredentialAuthWorkflow["getActiveSessions"]>[0],
	): ReturnType<CredentialAuthWorkflow["getActiveSessions"]> {
		return this.workflow.getActiveSessions(userId);
	}
}

@Injectable()
export class RevokeSessionUseCase {
	constructor(private readonly workflow: CredentialAuthWorkflow) {}
	execute(
		userId: Parameters<CredentialAuthWorkflow["revokeSession"]>[0],
		sessionId: Parameters<CredentialAuthWorkflow["revokeSession"]>[1],
		metadata?: Parameters<CredentialAuthWorkflow["revokeSession"]>[2],
	): ReturnType<CredentialAuthWorkflow["revokeSession"]> {
		return this.workflow.revokeSession(userId, sessionId, metadata);
	}
}
