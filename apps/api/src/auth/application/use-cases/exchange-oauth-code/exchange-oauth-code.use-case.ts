import { Injectable } from "@nestjs/common";
import { OAuthWorkflow } from "../../workflows/oauth.workflow";

@Injectable()
export class ExchangeOAuthCodeUseCase {
	constructor(private readonly workflow: OAuthWorkflow) {}
	execute(
		code: Parameters<OAuthWorkflow["exchangeCodeForTokens"]>[0],
	): ReturnType<OAuthWorkflow["exchangeCodeForTokens"]> {
		return this.workflow.exchangeCodeForTokens(code);
	}
}
