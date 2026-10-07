import type { CredentialAuthWorkflow } from "../../workflows/auth/credential-auth.workflow.js";

interface RevokeSessionDependencies {
  readonly workflow: CredentialAuthWorkflow;
}

export class RevokeSession {
  readonly #dependencies: RevokeSessionDependencies;

  constructor(dependencies: RevokeSessionDependencies) {
    this.#dependencies = dependencies;
  }
  execute(
    userId: Parameters<CredentialAuthWorkflow["revokeSession"]>[0],
    sessionId: Parameters<CredentialAuthWorkflow["revokeSession"]>[1],
    metadata?: Parameters<CredentialAuthWorkflow["revokeSession"]>[2],
  ): ReturnType<CredentialAuthWorkflow["revokeSession"]> {
    return this.#dependencies.workflow.revokeSession(userId, sessionId, metadata);
  }
}
