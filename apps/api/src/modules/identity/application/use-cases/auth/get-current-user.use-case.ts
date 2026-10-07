import type { CredentialAuthWorkflow } from "../../workflows/auth/credential-auth.workflow.js";

interface GetCurrentUserDependencies {
  readonly workflow: CredentialAuthWorkflow;
}

export class GetCurrentUser {
  readonly #dependencies: GetCurrentUserDependencies;

  constructor(dependencies: GetCurrentUserDependencies) {
    this.#dependencies = dependencies;
  }
  execute(
    userId: Parameters<CredentialAuthWorkflow["getCurrentUser"]>[0],
    email: Parameters<CredentialAuthWorkflow["getCurrentUser"]>[1],
    sessionId: Parameters<CredentialAuthWorkflow["getCurrentUser"]>[2],
  ): ReturnType<CredentialAuthWorkflow["getCurrentUser"]> {
    return this.#dependencies.workflow.getCurrentUser(userId, email, sessionId);
  }
}
