import type { OAuthWorkflow } from "../../workflows/auth/oauth.workflow.js";

interface ExchangeOAuthCodeDependencies {
  readonly workflow: OAuthWorkflow;
}

export class ExchangeOAuthCode {
  readonly #dependencies: ExchangeOAuthCodeDependencies;

  constructor(dependencies: ExchangeOAuthCodeDependencies) {
    this.#dependencies = dependencies;
  }
  execute(
    code: Parameters<OAuthWorkflow["exchangeCodeForTokens"]>[0],
  ): ReturnType<OAuthWorkflow["exchangeCodeForTokens"]> {
    return this.#dependencies.workflow.exchangeCodeForTokens(code);
  }
}
