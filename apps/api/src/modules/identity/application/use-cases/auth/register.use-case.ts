import type { CredentialAuthWorkflow } from "../../workflows/auth/credential-auth.workflow.js";

interface RegisterDependencies {
  readonly workflow: CredentialAuthWorkflow;
}

export class Register {
  readonly #dependencies: RegisterDependencies;

  constructor(dependencies: RegisterDependencies) {
    this.#dependencies = dependencies;
  }
  execute(
    input: Parameters<CredentialAuthWorkflow["register"]>[0],
    metadata?: Parameters<CredentialAuthWorkflow["register"]>[1],
  ): ReturnType<CredentialAuthWorkflow["register"]> {
    return this.#dependencies.workflow.register(input, metadata);
  }
}
