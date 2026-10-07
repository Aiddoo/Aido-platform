import type { PasswordWorkflow } from "../../workflows/auth/password.workflow.js";

interface RequestPasswordSetupCodeDependencies {
  readonly workflow: PasswordWorkflow;
}

export class RequestPasswordSetupCode {
  readonly #dependencies: RequestPasswordSetupCodeDependencies;

  constructor(dependencies: RequestPasswordSetupCodeDependencies) {
    this.#dependencies = dependencies;
  }
  execute(
    userId: Parameters<PasswordWorkflow["requestPasswordSetupCode"]>[0],
  ): ReturnType<PasswordWorkflow["requestPasswordSetupCode"]> {
    return this.#dependencies.workflow.requestPasswordSetupCode(userId);
  }
}
