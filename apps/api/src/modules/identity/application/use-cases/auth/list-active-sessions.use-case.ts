import type { CredentialAuthWorkflow } from "../../workflows/auth/credential-auth.workflow.js";

interface ListActiveSessionsDependencies {
  readonly workflow: CredentialAuthWorkflow;
}

export class ListActiveSessions {
  readonly #dependencies: ListActiveSessionsDependencies;

  constructor(dependencies: ListActiveSessionsDependencies) {
    this.#dependencies = dependencies;
  }
  execute(
    userId: Parameters<CredentialAuthWorkflow["getActiveSessions"]>[0],
  ): ReturnType<CredentialAuthWorkflow["getActiveSessions"]> {
    return this.#dependencies.workflow.getActiveSessions(userId);
  }
}
