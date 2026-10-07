import type { CredentialAuthWorkflow } from "../../workflows/auth/credential-auth.workflow.js";

interface LogoutDependencies {
  readonly workflow: CredentialAuthWorkflow;
}

export class Logout {
  readonly #dependencies: LogoutDependencies;

  constructor(dependencies: LogoutDependencies) {
    this.#dependencies = dependencies;
  }
  execute(
    userId: Parameters<CredentialAuthWorkflow["logout"]>[0],
    sessionId: Parameters<CredentialAuthWorkflow["logout"]>[1],
    metadata?: Parameters<CredentialAuthWorkflow["logout"]>[2],
  ): ReturnType<CredentialAuthWorkflow["logout"]> {
    return this.#dependencies.workflow.logout(userId, sessionId, metadata);
  }
}
