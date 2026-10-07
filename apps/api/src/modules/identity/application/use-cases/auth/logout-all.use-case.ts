import type { CredentialAuthWorkflow } from "../../workflows/auth/credential-auth.workflow.js";

interface LogoutAllDependencies {
  readonly workflow: CredentialAuthWorkflow;
}

export class LogoutAll {
  readonly #dependencies: LogoutAllDependencies;

  constructor(dependencies: LogoutAllDependencies) {
    this.#dependencies = dependencies;
  }
  execute(
    userId: Parameters<CredentialAuthWorkflow["logoutAll"]>[0],
    metadata?: Parameters<CredentialAuthWorkflow["logoutAll"]>[1],
  ): ReturnType<CredentialAuthWorkflow["logoutAll"]> {
    return this.#dependencies.workflow.logoutAll(userId, metadata);
  }
}
