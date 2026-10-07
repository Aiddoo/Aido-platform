import type { CredentialAuthWorkflow } from "../../workflows/auth/credential-auth.workflow.js";

interface VerifyEmailDependencies {
  readonly workflow: CredentialAuthWorkflow;
}

export class VerifyEmail {
  readonly #dependencies: VerifyEmailDependencies;

  constructor(dependencies: VerifyEmailDependencies) {
    this.#dependencies = dependencies;
  }
  execute(
    input: Parameters<CredentialAuthWorkflow["verifyEmail"]>[0],
    metadata?: Parameters<CredentialAuthWorkflow["verifyEmail"]>[1],
  ): ReturnType<CredentialAuthWorkflow["verifyEmail"]> {
    return this.#dependencies.workflow.verifyEmail(input, metadata);
  }
}
