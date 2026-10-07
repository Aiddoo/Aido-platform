import type { CredentialAuthWorkflow } from "../../workflows/auth/credential-auth.workflow.js";

interface DeleteAccountDependencies {
  readonly workflow: CredentialAuthWorkflow;
}

export class DeleteAccount {
  readonly #dependencies: DeleteAccountDependencies;

  constructor(dependencies: DeleteAccountDependencies) {
    this.#dependencies = dependencies;
  }
  execute(
    userId: Parameters<CredentialAuthWorkflow["deleteAccount"]>[0],
    sessionId: Parameters<CredentialAuthWorkflow["deleteAccount"]>[1],
    input: Parameters<CredentialAuthWorkflow["deleteAccount"]>[2],
    metadata?: Parameters<CredentialAuthWorkflow["deleteAccount"]>[3],
  ): ReturnType<CredentialAuthWorkflow["deleteAccount"]> {
    return this.#dependencies.workflow.deleteAccount(userId, sessionId, input, metadata);
  }
}
