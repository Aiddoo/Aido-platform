import type { OAuthWorkflow } from "../../workflows/auth/oauth.workflow.js";

interface GetOAuthRedirectUriDependencies {
  readonly workflow: OAuthWorkflow;
}

export class GetOAuthRedirectUri {
  readonly #dependencies: GetOAuthRedirectUriDependencies;

  constructor(dependencies: GetOAuthRedirectUriDependencies) {
    this.#dependencies = dependencies;
  }
  execute(state: string): ReturnType<OAuthWorkflow["getRedirectUriByState"]> {
    return this.#dependencies.workflow.getRedirectUriByState(state);
  }
}
