import type { CredentialAuthWorkflow } from "../../workflows/auth/credential-auth.workflow.js";

interface LoginWithPasswordDependencies {
  readonly workflow: CredentialAuthWorkflow;
}

export class LoginWithPassword {
  readonly #dependencies: LoginWithPasswordDependencies;

  constructor(dependencies: LoginWithPasswordDependencies) {
    this.#dependencies = dependencies;
  }
  execute(
    input: Parameters<CredentialAuthWorkflow["login"]>[0],
    metadata?: Parameters<CredentialAuthWorkflow["login"]>[1],
  ): ReturnType<CredentialAuthWorkflow["login"]> {
    return this.#dependencies.workflow.login(input, metadata);
  }
}
