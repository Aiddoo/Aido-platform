import type { OAuthWorkflow } from "../../workflows/auth/oauth.workflow.js";

interface LinkOAuthAccountWithCodeDependencies {
  readonly workflow: OAuthWorkflow;
}

export class LinkOAuthAccountWithCode {
  readonly #dependencies: LinkOAuthAccountWithCodeDependencies;

  constructor(dependencies: LinkOAuthAccountWithCodeDependencies) {
    this.#dependencies = dependencies;
  }
  execute(
    ...args: Parameters<OAuthWorkflow["linkAccountWithExchangeCode"]>
  ): ReturnType<OAuthWorkflow["linkAccountWithExchangeCode"]> {
    return this.#dependencies.workflow.linkAccountWithExchangeCode(...args);
  }
}
