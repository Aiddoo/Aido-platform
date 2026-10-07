import type { OAuthWorkflow } from "../../workflows/auth/oauth.workflow.js";

interface ListLinkedAccountsDependencies {
  readonly workflow: OAuthWorkflow;
}

export class ListLinkedAccounts {
  readonly #dependencies: ListLinkedAccountsDependencies;

  constructor(dependencies: ListLinkedAccountsDependencies) {
    this.#dependencies = dependencies;
  }
  execute(
    userId: Parameters<OAuthWorkflow["getLinkedAccounts"]>[0],
  ): ReturnType<OAuthWorkflow["getLinkedAccounts"]> {
    return this.#dependencies.workflow.getLinkedAccounts(userId);
  }
}
