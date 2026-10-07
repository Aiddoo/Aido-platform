import type { OAuthWorkflow } from "../../workflows/auth/oauth.workflow.js";

interface LinkOAuthAccountDependencies {
  readonly workflow: OAuthWorkflow;
}

export class LinkOAuthAccount {
  readonly #dependencies: LinkOAuthAccountDependencies;

  constructor(dependencies: LinkOAuthAccountDependencies) {
    this.#dependencies = dependencies;
  }
  execute(
    ...args: Parameters<OAuthWorkflow["linkSocialAccountWithToken"]>
  ): ReturnType<OAuthWorkflow["linkSocialAccountWithToken"]> {
    return this.#dependencies.workflow.linkSocialAccountWithToken(...args);
  }
}
