import type { OAuthWorkflow } from "../../workflows/auth/oauth.workflow.js";

interface UnlinkOAuthAccountDependencies {
  readonly workflow: OAuthWorkflow;
}

export class UnlinkOAuthAccount {
  readonly #dependencies: UnlinkOAuthAccountDependencies;

  constructor(dependencies: UnlinkOAuthAccountDependencies) {
    this.#dependencies = dependencies;
  }
  execute(
    userId: Parameters<OAuthWorkflow["unlinkAccount"]>[0],
    provider: Parameters<OAuthWorkflow["unlinkAccount"]>[1],
    metadata?: Parameters<OAuthWorkflow["unlinkAccount"]>[2],
  ): ReturnType<OAuthWorkflow["unlinkAccount"]> {
    return this.#dependencies.workflow.unlinkAccount(userId, provider, metadata);
  }
}
