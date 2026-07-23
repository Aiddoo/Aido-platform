import { Injectable } from "@nestjs/common";
import { CredentialAuthWorkflow } from "../../workflows/credential-auth.workflow";

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
